import { z } from "zod";
// import { esmWrapper } from "./utils/esmWrapper";
// import { mockAxios } from "./utils/mockAxios";
import axiosFactory from "./";
import axios from "axios";

jest.mock("axios");

export const schema_note = z.object({
  note: z.string().min(1).max(50),
});

export const schema_id_and_note = z.object({
  id: z.number().min(1),
  note: z.string().min(1).max(50),
});

describe("axiosValidationFactory", () => {
  // it("can handle valid response", () => {
  //   expect.assertions(1);
  //   // jest.mock("axios", esmWrapper(mockaxios({ body: { note: `Dan` } })));

  //   const axiosValidator = axiosFactory((data) => schema_note.parse(data));

  //   return axiosValidator(`https://api.github.com/users/justsml`)
  //     .then((response) => response.json())
  //     .then((body) => {
  //       expect(body).toEqual({ note: "Dan" });
  //     });
  // });

  it("can throw on invalid response", () => {
    expect.assertions(1);
    // @ts-ignore
    axios.get.mockResolvedValue({
      data: { id: 1 },
    });
    const axiosValidator = axiosFactory({
      response: (data) => schema_id_and_note.parse(data),
    });

    return axiosValidator(`https://example.local/notes`).catch((error) =>
      expect(error).toBeInstanceOf(Error)
    );
  });

  it("can throw on invalid request body", () => {
    expect.assertions(1);
    // @ts-ignore
    axios.put.mockResolvedValue({
      data: { note: "Dan" },
    });

    const axiosValidator = axiosFactory({
      request: (data) => schema_id_and_note.parse(data),
    });

    return axiosValidator(`https://example.local/notes`, {
      method: "PUT",
      data: JSON.stringify({ note: "Dan" }),
    }).catch((error) => expect(error).toBeInstanceOf(Error));
  });

  // it("can validate request and response", () => {
  //   expect.assertions(1);
  //   jest.mock(
  //     "axios",
  //     esmWrapper(mockaxios({ body: { id: 42, note: `Dan` } }))
  //   );
  //   const axiosValidator = axiosFactory({
  //     response: (data) => schema_id_and_note.parse(data),
  //     request: (data) => schema_note.parse(data),
  //   });

  //   return axiosValidator(`https://example.local/notes`, {
  //     method: "POST",
  //     body: JSON.stringify({ note: "Dan" }),
  //   })
  //     .then((response) => response.json())
  //     .then((response) => {
  //       expect(response).toEqual({ id: 42, note: "Dan" });
  //     });
  // });

  // it("can validate valid request payload", () => {
  //   expect.assertions(1);
  //   jest.mock("axios", esmWrapper(mockaxios({ body: { id: 1 } })));
  //   const axiosValidator = axiosFactory({
  //     request: (data) => schema_note.parse(data),
  //   });

  //   return axiosValidator(`https://example.local/notes`, {
  //     method: "POST",
  //     body: JSON.stringify({ note: "Dan" }),
  //   })
  //     .then((response) => response.json())
  //     .then((data: any) => expect(data.id).toEqual(1));
  // });

  // it("can trigger callback on invalid response", () => {
  //   expect.assertions(1);
  //   jest.mock("axios", esmWrapper(mockaxios({ body: { id: 1 } })));
  //   const callback = jest.fn();
  //   const axiosValidator = axiosFactory(
  //     (data) => schema_id_and_note.parse(data),
  //     { callback, ignoreErrors: true }
  //   );

  //   return axiosValidator(`https://example.local/notes`)
  //     .then((response) => response.json())
  //     .then((_data) => expect(callback).toBeCalledTimes(1));
  // });

  it("can support multiple path-based validators", () => {
    expect.assertions(1);
    // @ts-ignore
    axios.mockResolvedValue(
      Promise.resolve({
        data: { id: 1 },
      })
    );
    const callback = jest.fn();
    const axiosValidator = axiosFactory(
      {
        "POST:/notes": {
          request: (data) => schema_note.parse(data),
          response: (data) => schema_id_and_note.parse(data),
        },
      },
      { callback, ignoreErrors: true }
    );

    return axiosValidator(`http://localhost.local/notes`, {
      method: "POST",
      data: JSON.stringify({ note: "Dan" }),
    })
      .then((_data) => {
        expect(callback).toBeCalledTimes(1);
      })
      .catch((error) => {
        throw error;
      });
  });
});
