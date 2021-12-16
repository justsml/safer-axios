/* eslint-disable @typescript-eslint/no-redeclare */
import type {
  AxiosRequestConfig,
  AxiosRequestHeaders,
  AxiosResponse,
  AxiosResponseHeaders,
} from "axios";
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
  options?: AxiosFactoryOptions
) {
  let callback =
    typeof options === "function" ? options : options?.callback ?? (() => {});
  let ignoreErrors = typeof options === "object" ? options.ignoreErrors : false;
  let pathMatcher: RuleMatcher<TInput, TOutput> | null = null;

  // Check for path matcher input
  if (
    typeof validator === "object" &&
    !validator.request &&
    !validator.response
  ) {
    // We have some path patterns to match!
    pathMatcher = getPathMatcher(validator);
  }
  /**
   *   (config: AxiosRequestConfig): AxiosPromise;
   *   (url: string, config?: AxiosRequestConfig): AxiosPromise;
   */
  return function axiosWrapper(url: string, config: AxiosRequestConfig = {}) {
    let _response: AxiosResponse<any, any> | null = null;

    if (pathMatcher !== null) {
      validator = pathMatcher(url, config.method || "GET");
    }
    let requestBodyValidator =
      typeof validator === "object" ? validator.request : undefined;
    let responseValidator =
      typeof validator === "function"
        ? validator
        : typeof validator === "object"
        ? validator.response
        : undefined;

        let data: any = null;
    // check request body
    if (requestBodyValidator && typeof requestBodyValidator === "function") {
      try {
        data = config.data;
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
      } catch (error) {
        callback({
          mode: "request",
          error,
          data,
          url,
          headers: config.headers,
        });
        if (!ignoreErrors) throw error;
      }
    }
    return import("axios").then(({ default: axios }) => {
      return axios(url, config).then((response) => {
        // save response to replay later.
        _response = response;
        // check the response
        if (responseValidator && typeof responseValidator === "function") {
          try {
            const validatorResult = responseValidator(response.data as any);
            if (!validatorResult)
              throw TypeError(
                `Invalid response body: ${JSON.stringify(response.data)}`
              );
          } catch (error) {
            callback({
              mode: "response",
              error,
              data: response.data,
              url,
              headers: _response.headers,
              status: _response.status,
            });
            if (!ignoreErrors) throw error;
          }
        }
        return response;
      });
    });
  };
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

    const matchingPath = pathMatchers.find(({ pattern }) =>
      pattern.test(inputPath)
    );
    const { path, key, method } = matchingPath || {};
    return path !== undefined && inputMethod === method ? rules[key!] : false;
  };
}

function getMethodPrefix(path: string) {
  let verb = (path.replace(/^([A-Z-]*) ?.*/g, "$1") || "get").toLowerCase();
  if (verb.startsWith("http")) verb = "get";
  return verb;
}

function getPathExtracted(path: string) {
  let verb = (
    path.replace(/^([a-z-]*):?(.*)$/gi, "$2") || "/////"
  ).toLowerCase();
  if (verb.startsWith("http")) verb = "get";
  return verb;
}
