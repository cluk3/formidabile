import { createFormApiClient } from "@fb/api-client";
import { FormApiLive, JwtActorResolver } from "@fb/http-api";
import { DatabaseTest } from "@fb/server/testing";
import { Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import { afterAll, expect, test } from "vite-plus/test";
import { seed } from "../seed/seed.ts";
import { type DevUser, devJwt, mintDevToken } from "../server/dev-users.ts";

// The module's API on a fresh PGlite database, checking tokens with the dev secret, as the seed's handler does.
const api = HttpRouter.toWebHandler(
  FormApiLive.pipe(
    Layer.provide([JwtActorResolver(devJwt), DatabaseTest]),
    Layer.provide(HttpServer.layerServices),
  ),
  { disableLogger: true },
);

afterAll(() => api.dispose());

const clientFor = (user: DevUser) =>
  createFormApiClient({
    baseUrl: "http://seed.test",
    getToken: () => mintDevToken(user),
    fetch: (request) => api.handler(request),
  });

test("the seed publishes one form in each dev tenant through the API", async () => {
  await seed((request) => api.handler(request));

  for (const admin of ["acme-admin", "globex-admin"] as const) {
    const { data } = await clientFor(admin).GET("/forms");

    expect(data?.forms).toEqual([
      expect.objectContaining({
        currentVersion: expect.objectContaining({ number: 1, publishedBy: admin }),
        hasDraft: false,
      }),
    ]);
  }
});
