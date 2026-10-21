import { createFormApiClient } from "@fb/api-client";
import { JwtActorResolver } from "@fb/http-api";
import { createFormModuleHandler, declareLength } from "@fb/http-api/web";
import { Actor, authenticate, TenantId } from "@fb/server/actor";
import { Effect, Option } from "effect";
import type { JWTPayload } from "jose";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { baseUrl, jwt, signToken } from "./api.ts";

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
    fetch: async (request) => {
      request.headers.set("cookie", "session=host");
      return custom.fetch(await declareLength(request));
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

test("a path parameter longer than the router's default 100 units reaches its endpoint", async () => {
  resolved = analyst("acme-analyst");
  const { response, error } = await createFormApiClient({
    baseUrl,
    getToken: () => null,
    fetch: async (request) => custom.fetch(await declareLength(request)),
  }).DELETE("/respondents/{respondentId}/responses", {
    params: { path: { respondentId: "😀".repeat(255) } },
  });

  expect(response.status).toBe(403);
  expect(error).toEqual({ _tag: "Forbidden", capability: "responses:delete" });
});

describe("a custom resolver and the JWT resolver", () => {
  const viaJwt = createFormModuleHandler({ databaseUrl, jwt });
  afterAll(() => viaJwt.dispose());

  const formId = "0192f5a0-7c3e-7b1a-9d2e-3f4a5b6c7d8e";
  const refs = [{ namespace: "project", refId: "apollo" }];
  const acme = TenantId.make("acme");

  const createWithToken = async (claims: JWTPayload) => {
    const token = await signToken(claims);
    return createFormApiClient({
      baseUrl,
      getToken: () => token,
      fetch: async (request) => viaJwt.fetch(await declareLength(request)),
    }).POST("/forms", { body: { definition: {} as never } });
  };

  const jwtActor = (claims: JWTPayload) =>
    Effect.runPromise(
      Effect.promise(() => signToken(claims)).pipe(
        Effect.flatMap((token) =>
          authenticate({ headers: { authorization: `Bearer ${token}` }, source: {} }),
        ),
        Effect.provide(JwtActorResolver(jwt)),
      ),
    );

  const outcome = ({ response, error }: { response: Response; error?: unknown }) => [
    response.status,
    error,
  ];

  test.each<[string, JWTPayload, Actor]>([
    [
      "a form-bound identified token with refs",
      { sub: "alice", tenant: "acme", capabilities: ["responses:read"], form: formId, refs },
      Actor.Identified({
        subject: "alice",
        tenant: acme,
        capabilities: ["responses:read"],
        formId: Option.some(formId),
        refs,
      }),
    ],
    [
      "a tenant-wide identified token",
      { sub: "alice", tenant: "acme", capabilities: [] },
      Actor.Identified({
        subject: "alice",
        tenant: acme,
        capabilities: [],
        formId: Option.none(),
        refs: [],
      }),
    ],
    [
      "an anonymous grant with refs",
      { anonymous: true, tenant: "acme", form: formId, refs },
      Actor.Anonymous({ tenant: acme, formId, refs }),
    ],
    [
      "an anonymous grant",
      { anonymous: true, tenant: "acme", form: formId },
      Actor.Anonymous({ tenant: acme, formId, refs: [] }),
    ],
  ])(
    "%s resolves to the actor a custom resolver gives, and both pass the same checks",
    async (_, claims, actor) => {
      expect(await jwtActor(claims)).toEqual(actor);
      const [custom, viaToken] = await Promise.all([createAs(actor), createWithToken(claims)]);
      expect(outcome(custom)).toEqual(outcome(viaToken));
      expect(outcome(custom)).toEqual([403, { _tag: "Forbidden", capability: "forms:manage" }]);
    },
  );

  const tooManyRefs = Array.from({ length: 21 }, (_, index) => ({
    namespace: "project",
    refId: `p-${index}`,
  }));

  test.each<[string, JWTPayload, Actor]>([
    [
      "256-code-point subject",
      { sub: "😀".repeat(256), tenant: "acme", capabilities: [] },
      Actor.Identified({
        subject: "😀".repeat(256),
        tenant: acme,
        capabilities: [],
        formId: Option.none(),
        refs: [],
      }),
    ],
    [
      "21 refs",
      { anonymous: true, tenant: "acme", form: formId, refs: tooManyRefs },
      Actor.Anonymous({ tenant: acme, formId, refs: tooManyRefs }),
    ],
    [
      "duplicate refs",
      { anonymous: true, tenant: "acme", form: formId, refs: [...refs, ...refs] },
      Actor.Anonymous({ tenant: acme, formId, refs: [...refs, ...refs] }),
    ],
    [
      "non-UUID form",
      { anonymous: true, tenant: "acme", form: "not-a-uuid" },
      Actor.Anonymous({ tenant: acme, formId: "not-a-uuid", refs: [] }),
    ],
    [
      "refs without a form",
      { sub: "alice", tenant: "acme", capabilities: [], refs },
      Actor.Identified({
        subject: "alice",
        tenant: acme,
        capabilities: [],
        formId: Option.none(),
        refs,
      }),
    ],
  ])(
    "an actor with a %s is refused with 401 invalid from either resolver",
    async (_, claims, actor) => {
      const [custom, viaToken] = await Promise.all([createAs(actor), createWithToken(claims)]);

      expect(outcome(custom)).toEqual([401, { _tag: "Unauthenticated", reason: "invalid" }]);
      expect(outcome(viaToken)).toEqual(outcome(custom));
    },
  );
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
