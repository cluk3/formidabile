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

const admin = devUsers["acme-admin"];
const projectRef = { namespace: "project", refId: "apollo" };
const refsFor = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ namespace: "project", refId: `p-${index}` }));
const withoutKey = <T extends object, K extends keyof T>(claims: T, key: K) => {
  const { [key]: _, ...rest } = claims;
  return rest;
};

describe("claim sets", () => {
  test.each<[string, JWTPayload]>([
    ["an identified token", admin],
    ["a form-bound identified token", { ...admin, form: formId }],
    ["an identified token with refs", { ...admin, form: formId, refs: [projectRef] }],
    ["an identified token with empty refs", { ...admin, form: formId, refs: [] }],
    ["an identified token with 20 refs", { ...admin, form: formId, refs: refsFor(20) }],
    ["a sub of 255 emoji", { ...admin, sub: "😀".repeat(255) }],
  ])("%s is accepted", async (_, claims) => {
    const { response } = await listWith(claims);

    expect(response.status).toBe(200);
  });

  test.each<[string, JWTPayload]>([
    ["an anonymous grant", grant],
    ["an anonymous grant with refs", { ...grant, refs: [projectRef] }],
  ])("%s is accepted, and refused on the admin endpoint", async (_, claims) => {
    const { response, error } = await listWith(claims);

    expect(response.status).toBe(403);
    expect(error).toEqual({ _tag: "Forbidden", capability: "responses:read" });
  });

  test.each<[string, JWTPayload]>([
    ["anonymous with sub", { ...grant, sub: "alice" }],
    ["anonymous with capabilities", { ...grant, capabilities: [] }],
    ["anonymous without form", withoutKey(grant, "form")],
    ["anonymous: false", { ...admin, anonymous: false }],
    ["neither sub nor anonymous", withoutKey(admin, "sub")],
    ["refs without form", { ...admin, refs: [projectRef] }],
    ["empty refs without form", { ...admin, refs: [] }],
    ["more than 20 refs", { ...admin, form: formId, refs: refsFor(21) }],
    ["a duplicate refs entry", { ...grant, refs: [projectRef, { ...projectRef }] }],
    ["a refs entry missing refId", { ...grant, refs: [{ namespace: "project" }] }],
    ["a refs entry with a numeric refId", { ...grant, refs: [{ namespace: "project", refId: 7 }] }],
    ["a refs entry with an empty refId", { ...grant, refs: [{ namespace: "project", refId: "" }] }],
    ["a 256-code-point refId", { ...grant, refs: [{ namespace: "p", refId: "😀".repeat(256) }] }],
    ["an uppercase namespace", { ...grant, refs: [{ namespace: "Project", refId: "apollo" }] }],
    ["a 65-character namespace", { ...grant, refs: [{ namespace: "p".repeat(65), refId: "a" }] }],
    ["refs that aren't an array", { ...grant, refs: projectRef }],
    ["a refs entry with an extra key", { ...grant, refs: [{ ...projectRef, label: "Apollo" }] }],
    ["a 256-code-point sub", { ...admin, sub: "😀".repeat(256) }],
    ["an empty sub", { ...admin, sub: "" }],
    ["a 256-code-point tenant", { ...admin, tenant: "😀".repeat(256) }],
    ["a 256-code-point grant tenant", { ...grant, tenant: "😀".repeat(256) }],
    ["a non-UUID form", { ...grant, form: "not-a-uuid" }],
    ["a non-UUID form on an identified token", { ...admin, form: "not-a-uuid" }],
  ])("%s gets 401 invalid", async (_, claims) => {
    const { response, error } = await listWith(claims);

    expect(response.status).toBe(401);
    expect(error).toEqual({ _tag: "Unauthenticated", reason: "invalid" });
  });
});

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
