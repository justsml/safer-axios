/* eslint-disable @typescript-eslint/no-redeclare */
import type {
  Axios,
  AxiosRequestConfig,
  AxiosRequestHeaders,
  AxiosResponse,
  AxiosResponseHeaders,
  AxiosStatic,
  Method,
} from "axios";
import axios from "axios";
import debug from "debug";
import { pathToRegexp } from "path-to-regexp";
import { URL } from "url";
import { HttpPathRules, Rules } from "..";

type RuleMatcher<TInput, TOutput> = (
  path: string,
  method: string
) => Rules<TInput, TOutput> | false;

type ValidationCallback = ({
  mode,
  error,
  data,
  url,
  status,
  headers,
}: {
  mode?: "response" | "request";
  error: Error;
  data: any;
  url: string;
  status?: number;
  headers?: AxiosRequestHeaders | AxiosResponseHeaders;
}) => void;

type AxiosFactoryOptions =
  | ValidationCallback
  | {
      callback: ValidationCallback;
      ignoreErrors?: boolean;
    };

/**
 *
 * ## Usage Examples
 *
 * ### Single Route, response validation
 *
 * Create a axios wrapper to validate a single **response**.
 *
 * ```ts
 * const checkUser = (data) => data.user != undefined;
 * const axios = axiosFactory(checkUser);
 * axios('/users/1')
 *   .then(response => response.json())
 *   .then(data => console.log(data));
 * ```
 *
 * ### Single Route, request validation
 *
 * Create a axios wrapper to validate a single **response**.
 *
 * ```ts
 * const checkUser = (data) => data.user != undefined;
 * const axios = axiosFactory({ request: checkUser });
 * axios('/users/1', { method: 'POST', body: JSON.stringify({ user: 'Dan' }) })
 *   .then(response => response.json())
 *   .then(data => console.log(data));
 * ```
 *
 * ### Multiple Routes
 *
 * Create a axios wrapper for `/users/:id?` and POST's to `/messages`.
 *
 * ```ts
 * const pathRules = {
 *   // matches `/users/123` and `/users/`
 *   `/users/:id?`: userSchemaCheck,
 *   // matches POST's to `/messages`
 *   `POST:/messages`: { request: messageSchemaCheck },
 * }
 * export default axiosFactory(pathRules);
 * ```
 *
 * @param validator
 * @returns
 */
export default function axiosFactory<TInput, TOutput>(
  validator: Rules<TInput, TOutput> | HttpPathRules<TInput, TOutput> | false,
  options?: AxiosFactoryOptions & AxiosRequestConfig<TInput>
) {
  const log = debug("safer-axios");
  const instance = axios.create(options);
  log("Creating base axios instance");
  let callback =
    typeof options === "function" ? options : options?.callback ?? (() => {});
  let ignoreErrors = typeof options === "object" ? options.ignoreErrors : false;
  let findHandlerByPath: RuleMatcher<TInput, TOutput> | null = null;

  log(`options: ${JSON.stringify(options)}`);

  // Check for path matcher input
  if (
    typeof validator === "object" &&
    Object.keys(validator).length > 0 &&
    !validator.request &&
    !validator.response
  ) {
    log("mode: path map found: ", validator);
    // We have some path patterns to match!
    findHandlerByPath = getPathMatcher(validator);
    log("mode: path map processed");
  }

  function getHandlersByPath(config: AxiosRequestConfig<any>) {
    const log = debug("axios-factory:getHandlersByPath");
    const request = config;
    let { url, method = "get" } = request;
    method = (method || "get").toLowerCase() as Method;
    const parsedUrl = new URL(url!);
    const pathName = parsedUrl.pathname;
    log(`Received path info: ${method} ${pathName}`);

    // Check for path matcher
    if (findHandlerByPath) {
      validator = findHandlerByPath(pathName, method);
      log(`Matched handler(s) in path map!`);
    }

    let requestValidator =
      typeof validator === "object" ? validator.request : undefined;
    let responseValidator =
      typeof validator === "function"
        ? validator
        : typeof validator === "object"
        ? validator.response
        : undefined;
    log(`Request validator? ${Boolean(requestValidator)}`);
    log(`Response validator? ${Boolean(responseValidator)}`);
    return { requestValidator, responseValidator };
  }

  instance.interceptors.request.use(function requestValidator(config) {
    let { requestValidator } = getHandlersByPath(config);

    checkRequestValidator();
    
    return config;
    function checkRequestValidator() {
      let data = config.data;
      if (requestValidator && typeof requestValidator === "function") {
        try {
          // Currently only JSON is supported.
          try {
            if (typeof data === "string") {
              data = JSON.parse(data);
            } else if (typeof data === "object") {
              data = data;
            }
          } catch (error) {
            throw new TypeError(
              `Unsupported body type. Validation only supports JSON encoded 'body'.`
            );
          }
          return requestValidator(data);
        } catch (error) {
          callback({
            mode: "request",
            error,
            data,
            url: config.url!,
            headers: config.headers,
          });
          if (!ignoreErrors) throw error;
        }
      }
    }
  });

  instance.interceptors.response.use(function responseValidator(response) {
    let { responseValidator } = getHandlersByPath(response.config);

    checkResponseValidator();

    return response;

    function checkResponseValidator() {
      if (responseValidator && typeof responseValidator === "function") {
        let data = response.data;
        try {
          const validatorResult = responseValidator(data as any);
          if (!validatorResult)
            throw TypeError(`Invalid response body: ${JSON.stringify(data)}`);
        } catch (error) {
          callback({
            mode: "response",
            error,
            data: data,
            status: response.status,
            url: response.request.url!,
            headers: response.headers,
          });
          if (!ignoreErrors) throw error;
        }
      }
    }
  }, function (error) {
    // Do something with request error
    return Promise.reject(error);
  });

  return instance;
}

const urlFragment = /^([a-z-]+:)?\/\//i;

function getPathMatcher<TInput, TOutput>(
  rules: HttpPathRules<TInput, TOutput>
): RuleMatcher<TInput, TOutput> {
  const paths = Object.keys(rules);

  const pathMatchers = paths.map((p) => ({
    key: p,
    method: getMethodPrefix(p),
    path: getPathExtracted(p), // TODO: Add HTTP VERB Support here-ish
    pattern: pathToRegexp(getPathExtracted(p)),
  }));

  return (inputPath: string, inputMethod: string = "get") => {
    inputMethod = inputMethod.toLowerCase();
    // Check for URL, extract path if it exists.
    if (urlFragment.test(inputPath)) {
      const url = new URL(inputPath);
      inputPath = url.pathname;
    }

    const matchingPath = pathMatchers.find(({ pattern, method }) =>
      pattern.test(inputPath) && inputMethod === method
    );
    const { path, key, method } = matchingPath || {};
    return path !== undefined ? rules[key!] : false;
  };
}

function getMethodPrefix(path: string) {
  let verb = (path.replace(/^([A-Z-]*) ?.*/g, "$1") || "get").toLowerCase();
  if (verb.startsWith("http")) verb = "get";
  return verb;
}

function getPathExtracted(path: string) {
  let verb = (
    path.replace(/^([a-z-]*) ?(.*)$/gi, "$2") || "/////"
  ).toLowerCase();
  if (verb.startsWith("http")) verb = "get";
  return verb;
}
