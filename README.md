# API Request & Response Runtime Validation

Runtime data validation of HTTP requests.

_For those who put too much trust in TypeScript_ ✨

## Examples

### Path based validation

```ts
// `./src/axios-safer.js`
import saferAxios from '@safer-api/axios';

export const pathMapping = {
  `/api/user`: checkUserResponse,
  `/api/repos/`: checkRepoResponse,
  `GET /api/notes`: data => schema_id_and_note.parse(data),
  `POST /api/notes`: {
    request: (data) => schema_note.parse(data),
    response: (data) => schema_id_and_note.parse(data),
  }
};

export default saferAxios(pathMapping);
```

#### Usage

Use the module exported with `saferAxios(pathConfig)` just as you would `axios(url, config)`.

```ts
import axiosSafer from './src/axios-safer'

axiosSafer('/api/notes')
.then(response => {
  // Response is now validated based on any matching path rules passed into `saferAxios(pathMapping)`
})
.catch(error => {
  // If the validation function returns `false` or throws an `Error`, we can handle it here.
});
```
