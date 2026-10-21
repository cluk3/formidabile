import type { JWTPayload } from "jose";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { devUsers, signToken, startApi } from "./api.ts";

const api = startApi();

afterAll(() => api.dispose());

const formId = "0192f5a0-7c3e-7b1a-9d2e-3f4a5b6c7d8e";

const grant = { anonymous: true, tenant: "acme", form: formId } satisfies JWTPayload;

const listWith = async (claims: JWTPayload) => {
  const token = await signToken(claims);
  return api.clientWithToken(() => token).GET("/forms");
};

describe("an anonymous grant", () => {
  test("gets 403 on every admin endpoint", async () => {
    const token = await signToken(grant);
    const client = api.clientWithToken(() => token);

    const results = await Promise.all([
      client.POST("/forms", { body: { definition: {} as never } }),
      client.GET("/forms"),
      client.GET("/forms/{formId}", { params: { path: { formId } } }),
    ]);

    expect(results.map(({ response, error }) => [response.status, error])).toEqual([
      [403, { _tag: "Forbidden", capability: "forms:manage" }],
      [403, { _tag: "Forbidden", capability: "responses:read" }],
      [403, { _tag: "Forbidden", capability: "responses:read" }],
    ]);
  });
});

void listWith;
void devUsers;
