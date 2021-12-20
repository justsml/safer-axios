# @safer-api/axios

[![NPM version](https://img.shields.io/npm/v/@safer-api/axios.svg)](https://www.npmjs.com/package/@safer-api/axios)
[![CI Status](https://github.com/justsml/safer-axios/workflows/test/badge.svg)](https://github.com/justsml/safer-axios/actions)

## API Validation - Centralized & Simplified

## Overview

The `@safer-api/axios` library lets you define request & response interceptors by http method & path.

While Axios provides interceptors to process requests and responses, it has no elegant way to do so conditionally per URL.

### Example `@safer-api/axios` 'validation router'

```ts
// Create a wrapper for `/api/notes` service:
const axiosNotesApi = saferAxios({
  `GET /api/notes`: {
    response: (notes) => notes.every(note => validate_id_and_note(note)),
  },
  `POST /api/notes`: {
    request: (data) => data?.id == undefined,
    response: (data) => data.id !== undefined,
  }
});
```

[See complete example.](#example)

It's similar in concept to Express Server/Router. You provide route handlers by path & method. So a `GET /some/thing/` would be handled by something like: `app.get('/some/thing', respondWithTheThing)`.

## Install

```bash
npm install @safer-api/axios

yarn add @safer-api/axios
```

## Design Notes

* Centrally manage API validation by HTTP Method + Path.
* Runs *Validation functions* per HTTP `request` payload and/or `response` body.
* Any request to unrecognized paths will be allowed **without any validation.**

* A *Validation function* matches `(errorDetails) => true | false | Error`
  1. Accept a JSON object.
  2. Succeed by returning any truthy value.
  3. Fail with either `throw Error('....')` or `return false`.

There are 2 main modes of operation:

1. [Fail on Error.](#fail-on-error) Breaks the flow of the Promise chain. Prevents bad data flowing in or out.
    * Use cases: log unexpected data from 3rd party data providers to Sentry or DataDog, microservice-to-microservice integration code.
2. [Log Silently.](#log-silently) A callback option can capture details about validation failures **silently**.
    * Use cases: log failures to Sentry or DataDog, microservice-to-microservice integration code, update React/Redux state (form error messages).

## Related Libraries

See [@safer-api/fetch](https://github.com/justsml/fetch-safely) for a browser `fetch` and `node-fetch` compatible version of this library.

## Example

### Step 1/2: Define your path & function mapping

Choose the mode that fits your use case: [`Fail on Error`](#fail-on-error) or [`Log Silently`](#log-silently).

#### Fail on Error

This configuration will bail out of the promise chain on any false-y return value or thrown error.

```ts
// `./src/services/notes.js`
import saferAxios from '@safer-api/axios';

export default saferAxios({
  `GET /api/notes`: data => schema_id_and_note.parse(data),
  `POST /api/notes`: {
    request: (data) => schema_note.parse(data),
    response: (data) => schema_id_and_note.parse(data),
  }
}); // Note: no options - default behavior is to reject on error.
```

#### Log Silently

To silently handle validation failures, we'll need to pass in an `options` parameter:

`{ ignoreErrors: true, callback: (details) => console.info(details) }`

```ts
// `./src/services/notes.js`
import saferAxios from '@safer-api/axios';

export default saferAxios({
  `GET /api/notes`: data => schema_id_and_note.parse(data),
  `POST /api/notes`: {
    request: (data) => schema_note.parse(data),
    response: (data) => schema_id_and_note.parse(data),
  }
}, {
  ignoreErrors: true,
  callback: (details) => console.info(details),
});
```

### Step 2/2: Replace `axios` calls with new `saferAxios` wrapper

Use the module exported with `saferAxios(pathConfig)` just as you would `axios(url, config)`, `axios.get(url, config)`, etc.

```ts
// `./src/modules/notes.js`
import axiosNotesApi from './src/services/notes'

export const listNotes = () => axiosNotesApi('/api/notes');

export const createNote = (data) =>
  axiosNotesApi('/api/notes', {method: 'post', data});

export const updateNote = (id, data) =>
  axiosNotesApi(`/api/notes/${id}`, {method: 'post', data});
```

## TODO

* [ ] Support **transforming** payloads.
* [ ] Support full URL, w/ domain. (Query string pattern matching?)
* [ ] Dynamic path & validation interface. (`registerHandler(method, path, handler: fn | fn[])`, `appendHandler(method, path, handler: fn | fn[])`, `listHandlers(): PathMapping[]`)
* [ ] Chaining arrays of functions. (Or include a `pipeline` composition example.)
