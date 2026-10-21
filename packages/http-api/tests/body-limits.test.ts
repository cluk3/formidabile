import { afterAll, describe, expect, test } from "vite-plus/test";
import { baseUrl, devUsers, signToken, startApi } from "./api.ts";

const api = startApi();

afterAll(() => api.dispose());

const MiB = 1024 * 1024;
const KiB = 1024;

const formId = "0192f5a0-7c3e-7b1a-9d2e-3f4a5b6c7d8e";
const bytes = (text: string) => new TextEncoder().encode(text).byteLength;

/** A request as the module sees it in-process: no transport fills in `content-length`. */
const send = async (
  method: string,
  path: string,
  body: BodyInit,
  headers: Record<string, string> = {},
) => {
  const request = new Request(`${baseUrl}${path}`, {
    method,
    body,
    headers: {
      authorization: `Bearer ${await signToken(devUsers["acme-admin"])}`,
      "content-type": "application/json",
      ...headers,
    },
  });
  const response = await api.fetch(request);
  return { request, status: response.status, error: await response.json().catch(() => null) };
};

describe("a body declaring more than its endpoint's limit gets 413", () => {
  test("a draft save over 1 MiB", async () => {
    const { status, error } = await send("PUT", `/forms/${formId}/draft`, "{}", {
      "content-length": String(MiB + 1),
    });

    expect(status).toBe(413);
    expect(error).toEqual({ _tag: "PayloadTooLarge", limit: MiB });
  });

  test("a create over 1 MiB", async () => {
    const { status, error } = await send("POST", "/forms", "{}", {
      "content-length": String(MiB + 1),
    });

    expect(status).toBe(413);
    expect(error).toEqual({ _tag: "PayloadTooLarge", limit: MiB });
  });

  test("a settings PATCH over 16 KiB", async () => {
    const { status, error } = await send("PATCH", `/forms/${formId}`, "{}", {
      "content-length": String(16 * KiB + 1),
    });

    expect(status).toBe(413);
    expect(error).toEqual({ _tag: "PayloadTooLarge", limit: 16 * KiB });
  });

  test("a publish over 16 KiB", async () => {
    const { status, error } = await send("POST", `/forms/${formId}/draft/publish`, "{}", {
      "content-length": String(16 * KiB + 1),
    });

    expect(status).toBe(413);
    expect(error).toEqual({ _tag: "PayloadTooLarge", limit: 16 * KiB });
  });

  test("a body sent to an endpoint that takes none", async () => {
    const { status, error } = await send("DELETE", `/forms/${formId}?expectedRevision=1`, "{}", {
      "content-length": String(16 * KiB + 1),
    });

    expect(status).toBe(413);
    expect(error).toEqual({ _tag: "PayloadTooLarge", limit: 16 * KiB });
  });
});

test("the body is refused before any of it is read", async () => {
  let pulls = 0;
  const body = new ReadableStream<Uint8Array>(
    {
      pull: (controller) => {
        pulls += 1;
        controller.enqueue(new Uint8Array(KiB));
        if (pulls > MiB / KiB) controller.close();
      },
    },
    { highWaterMark: 0 },
  );
  const init = {
    method: "PUT",
    body,
    duplex: "half",
    headers: {
      authorization: `Bearer ${await signToken(devUsers["acme-admin"])}`,
      "content-type": "application/json",
      "content-length": String(MiB + 1),
    },
  };
  const request = new Request(`${baseUrl}/forms/${formId}/draft`, init);

  const response = await api.fetch(request);

  expect(response.status).toBe(413);
  expect(pulls).toBe(0);
  expect(request.bodyUsed).toBe(false);
});

test("a definition body of exactly 1 MiB is accepted", async () => {
  const question = () => ({
    id: crypto.randomUUID(),
    type: "boolean" as const,
    label: "日".repeat(500),
    description: "日".repeat(2000),
    required: false,
    config: {},
  });
  const questions: Array<ReturnType<typeof question>> = [];
  const bodyWith = (description: string) =>
    JSON.stringify({ definition: { format: 1, title: "Large", description, questions } });
  while (bytes(bodyWith("")) <= MiB) questions.push(question());
  questions.pop();
  const padding = MiB - bytes(bodyWith(""));
  const body = bodyWith("日".repeat(Math.floor(padding / 3)) + "a".repeat(padding % 3));
  expect(bytes(body)).toBe(MiB);

  const { status } = await send("POST", "/forms", body, { "content-length": String(MiB) });

  expect(status).toBe(201);
});

describe("a body that doesn't declare its length gets 411", () => {
  test("a chunked body", async () => {
    const init = {
      method: "PUT",
      body: new Blob(['{"expectedRevision":null,"definition":{}}']).stream(),
      duplex: "half",
      headers: {
        authorization: `Bearer ${await signToken(devUsers["acme-admin"])}`,
        "content-type": "application/json",
        "transfer-encoding": "chunked",
      },
    };

    const response = await api.fetch(new Request(`${baseUrl}/forms/${formId}/draft`, init));

    expect(response.status).toBe(411);
    expect(await response.json()).toEqual({ _tag: "LengthRequired" });
  });

  test("an in-process body with no content-length", async () => {
    const { status, error } = await send("PATCH", `/forms/${formId}`, '{"availability":"open"}');

    expect(status).toBe(411);
    expect(error).toEqual({ _tag: "LengthRequired" });
  });

  test("a malformed content-length", async () => {
    const { status, error } = await send("PATCH", `/forms/${formId}`, "{}", {
      "content-length": "12abc",
    });

    expect(status).toBe(411);
    expect(error).toEqual({ _tag: "LengthRequired" });
  });
});

test("a request with no body passes", async () => {
  const response = await api.fetch(
    new Request(`${baseUrl}/forms`, {
      headers: { authorization: `Bearer ${await signToken(devUsers["acme-admin"])}` },
    }),
  );

  expect(response.status).toBe(200);
});
