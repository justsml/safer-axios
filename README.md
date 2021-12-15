# API Request & Response Runtime Validation

Runtime data validation of HTTP requests.

_For those who put too much trust in TypeScript_ ✨

## Examples

### Path based validation

```ts
import axiosSafely from 'axios-safely';

export const paths = {
  `/api/user`: checkUserSchema,
  `/api/repos/`: checkRepoSchema,
  `GET /api/notes`: data => schema_id_and_note.parse(data),
  `POST /api/notes`: {
    request: (data) => schema_note.parse(data),
    response: (data) => schema_id_and_note.parse(data),
  }
};

export default axiosSafely(paths);
```
