import { createFormApiClient } from "@fb/api-client";
import { createFormModuleHandler } from "@fb/http-api/web";
import { Actor, TenantId } from "@fb/server/actor";
import { Option } from "effect";
import { afterAll, expect, test } from "vite-plus/test";
import { baseUrl, jwt } from "./api.ts";

// Every request here is answered before the handler reaches the database.
const databaseUrl = "postgres://localhost/unused";

const analyst = (subject: string) =>
  Actor.Identified({
    subject,
    tenant: TenantId.make("acme"),
    capabilities: ["responses:read"],
    formId: Option.none(),
    refs: [],
  });

const seenByResolver: Array<string | null> = [];
let resolved: Actor | null = null;

const custom = createFormModuleHandler({
  databaseUrl,
  resolveActor: async (request) => {
    seenByResolver.push(request.headers.get("cookie"));
    return resolved;
  },
});
const withCors = createFormModuleHandler({ databaseUrl, jwt, cors: ["http://builder.test"] });

afterAll(async () => {
  await custom.dispose();
  await withCors.dispose();
});

const createAs = (actor: Actor | null) => {
  resolved = actor;
  return createFormApiClient({
    baseUrl,
    getToken: () => null,
    fetch: (request) => {
      request.headers.set("cookie", "session=host");
      return custom.fetch(request);
    },
  }).POST("/forms", { body: { definition: {} as never } });
};

test("a custom resolver gets the host's request, and its actor is authorized like any other", async () => {
  const { response, error } = await createAs(analyst("acme-analyst"));

  expect(seenByResolver.at(-1)).toBe("session=host");
  expect(response.status).toBe(403);
  expect(error).toEqual({ _tag: "Forbidden", capability: "forms:manage" });
});

test("a custom resolver that finds no actor gives 401 missing", async () => {
  const { response, error } = await createAs(null);

  expect(response.status).toBe(401);
  expect(error).toEqual({ _tag: "Unauthenticated", reason: "missing" });
});

test("a custom resolver's actor is held to the claim limits", async () => {
  const { response, error } = await createAs(analyst("😀".repeat(256)));

  expect(response.status).toBe(401);
  expect(error).toEqual({ _tag: "Unauthenticated", reason: "invalid" });
});

const preflight = (origin: string) =>
  withCors.fetch(
    new Request(`${baseUrl}/forms`, {
      method: "OPTIONS",
      headers: {
        origin,
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization, content-type",
      },
    }),
  );

test("cors lets a listed origin call with credentials", async () => {
  const response = await preflight("http://builder.test");

  expect(response.headers.get("access-control-allow-origin")).toBe("http://builder.test");
  expect(response.headers.get("access-control-allow-credentials")).toBe("true");
});

test("cors doesn't let an unlisted origin call", async () => {
  const response = await preflight("http://elsewhere.test");

  expect(response.headers.get("access-control-allow-origin")).not.toBe("http://elsewhere.test");
});
