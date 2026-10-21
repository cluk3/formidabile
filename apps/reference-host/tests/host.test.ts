import { createFormApiClient } from "@fb/api-client";
import { FormApiLive, JwtActorResolver } from "@fb/http-api";
import { DatabaseTest } from "@fb/server/testing";
import { Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import { jwtVerify } from "jose";
import { afterAll, expect, test } from "vite-plus/test";
import { devJwt } from "../server/dev-users.ts";
import { builderOrigin, createReferenceHost } from "../server/host.ts";

const origin = "http://localhost:4173";

// The module's API on a fresh PGlite database, checking tokens with the dev secret, as the plugin's handler does.
const api = HttpRouter.toWebHandler(
  FormApiLive.pipe(
    Layer.provide([JwtActorResolver(devJwt), DatabaseTest]),
    Layer.provide(HttpServer.layerServices),
  ),
  { disableLogger: true },
);
// `DatabaseTest` is already migrated; the count shows the host asks once, before the API's first request.
let migrations = 0;
const host = createReferenceHost({
  fetch: (request) => api.handler(request),
  migrate: async () => {
    migrations += 1;
  },
  dispose: api.dispose,
});

afterAll(() => host.dispose());

const signIn = async (user: string) => {
  const response = await host.fetch(
    new Request(`${origin}/login`, { method: "POST", body: new URLSearchParams({ user }) }),
  );
  expect(response.status).toBe(303);
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
};

const token = (cookie: string, headers: Record<string, string> = {}) =>
  host.fetch(new Request(`${origin}/token`, { headers: { cookie, ...headers } }));

const allCapabilities = ["forms:manage", "responses:read", "responses:delete"];

test.each([
  ["acme-admin", "acme", allCapabilities],
  ["acme-analyst", "acme", ["responses:read"]],
  ["globex-admin", "globex", allCapabilities],
  ["alice", "acme", []],
  ["bob", "acme", []],
])("/token mints %s a tenant-wide identified token", async (user, tenant, capabilities) => {
  const response = await token(await signIn(user));

  expect(response.status).toBe(200);
  const { token: minted } = (await response.json()) as { token: string };
  const { payload } = await jwtVerify(
    minted,
    new TextEncoder().encode("reference-host-dev-secret"),
    {
      issuer: "reference-host",
      audience: "form-module",
      algorithms: ["HS256"],
      requiredClaims: ["exp"],
    },
  );
  expect(payload).toEqual({
    sub: user,
    tenant,
    capabilities,
    iss: "reference-host",
    aud: "form-module",
    iat: expect.any(Number),
    exp: expect.any(Number),
  });
});

test("/token gives 401 for the anonymous user, signed out or never signed in", async () => {
  await signIn("acme-admin");

  expect((await token(await signIn("anonymous"))).status).toBe(401);
  expect((await token("")).status).toBe(401);
});

test("an acme-admin token creates a form through /api", async () => {
  const cookie = await signIn("acme-admin");
  const client = createFormApiClient({
    baseUrl: `${origin}/api`,
    getToken: async () => ((await (await token(cookie)).json()) as { token: string }).token,
    fetch: (request) => host.fetch(request),
  });
  const definition = {
    format: 1 as const,
    title: "Through the host",
    questions: [
      {
        id: crypto.randomUUID(),
        type: "boolean" as const,
        label: "Ready?",
        required: true,
        config: {},
      },
    ],
  };

  expect(migrations).toBe(0);
  const created = await client.POST("/forms", { body: { definition } });
  const listed = await client.GET("/forms");

  expect(migrations).toBe(1);
  expect(created.response.status).toBe(201);
  expect(listed.data?.forms.map((form) => form.id)).toContain(created.data?.form.id);
});

test("/token answers the builder's origin with credentials", async () => {
  const response = await token(await signIn("acme-admin"), { origin: builderOrigin });

  expect(response.headers.get("access-control-allow-origin")).toBe(builderOrigin);
  expect(response.headers.get("access-control-allow-credentials")).toBe("true");
});
