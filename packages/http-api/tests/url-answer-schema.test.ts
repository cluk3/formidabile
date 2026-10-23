import { validateAnswers } from "@fb/core/answers";
import { parseDefinition } from "@fb/core/definition";
import { Ajv2020 } from "ajv/dist/2020.js";
import formats from "ajv-formats";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { signToken, startApi } from "./api.ts";

const api = startApi();
afterAll(() => api.dispose());

const admin = api.clientAs("acme-admin");
const alice = api.clientWithToken(() =>
  signToken({ sub: "alice", tenant: "acme", capabilities: [] }),
);

const urlId = "0192f5a0-7c3e-7b1a-9d2e-000000000088";

const definition = {
  format: 1 as const,
  title: "Links",
  questions: [
    {
      id: urlId,
      type: "url" as const,
      label: "Website",
      required: true,
      config: {},
    },
  ],
};

const prefix = "https://example.com/";
const within = prefix + "a".repeat(2048 - [...prefix].length);
const beyond = within + "a";
const withEmoji = prefix + "😀" + "a".repeat(2048 - [...prefix].length - 1);

/** `accepted` is the server's answer. `browser` differs only where JSON Schema cannot say what the server does. */
const cases: ReadonlyArray<{
  name: string;
  value: unknown;
  accepted: boolean;
  /** Set when the advisory schema cannot match the server. */
  browser?: boolean;
}> = [
  { name: "https", value: "https://example.com", accepted: true },
  { name: "http", value: "http://example.com", accepted: true },
  { name: "the typed case", value: "HTTPS://Example.COM/Path", accepted: true },
  { name: "localhost", value: "http://localhost:3000/a", accepted: true },
  { name: "an IP address", value: "http://127.0.0.1", accepted: true },
  { name: "IPv6", value: "http://[::1]/", accepted: true },
  { name: "a non-ASCII host", value: "https://münchen.de/ä", accepted: true },
  { name: "2,048 code points", value: within, accepted: true },
  {
    name: "2,048 code points in more UTF-16 units",
    value: withEmoji,
    accepted: true,
    browser: false,
  },
  { name: "2,049 code points", value: beyond, accepted: false },
  { name: "surrounding spaces", value: "  https://example.com  ", accepted: true, browser: false },
  {
    name: "three slashes the parser still reads",
    value: "http:///path",
    accepted: true,
    browser: false,
  },
  { name: "no scheme", value: "example.com", accepted: false },
  { name: "ftp", value: "ftp://example.com", accepted: false },
  { name: "javascript", value: "javascript:alert(1)", accepted: false },
  { name: "no host", value: "https://", accepted: false },
  { name: "a query and no host", value: "http://?q=1", accepted: false },
  { name: "a scheme without slashes", value: "http:example.com", accepted: false },
  { name: "empty", value: "", accepted: false },
];

describe("the URL answer schema", () => {
  test("expresses an http or https URL with a host, at most 2,048 characters", async () => {
    const created = await admin.POST("/forms", { body: { definition } });
    const { form, draft } = created.data!;
    const published = await admin.POST("/forms/{formId}/draft/publish", {
      params: { path: { formId: form.id } },
      body: { expectedRevision: draft.revision },
    });
    await admin.PATCH("/forms/{formId}", {
      params: { path: { formId: form.id } },
      body: { availability: "open" },
    });
    const versionId = published.data!.version.id;

    const { data, response } = await alice.GET(
      "/respond/forms/{formId}/versions/{versionId}/answer-schema",
      { params: { path: { formId: form.id, versionId } } },
    );

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      type: "object",
      required: [urlId],
      properties: {
        [urlId]: {
          type: "string",
          maxLength: 2048,
          pattern: "^(?i:https?):\\/\\/[^\\s/?#]+[^\\s]*$",
        },
      },
    });

    const ajv = new Ajv2020({ allErrors: true });
    formats.default(ajv);
    const browser = ajv.compile(data!);
    const server = parseDefinition(definition);
    if (!server.ok) throw new Error("The test definition doesn't parse");

    for (const { name, value, accepted, browser: advisory } of cases) {
      const input = { [urlId]: value };
      expect(validateAnswers(server.value, input).ok, name).toBe(accepted);
      expect(browser(input), name).toBe(advisory ?? accepted);
    }
  });
});
