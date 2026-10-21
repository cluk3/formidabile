import { createFormApiClient, type FormApiClient } from "@fb/api-client";
import { FormApiLive, JwtActorResolver } from "@fb/http-api";
import { declareLength } from "@fb/http-api/web";
import { DatabaseTest } from "@fb/server/testing";
import { Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import { type JWTPayload, SignJWT } from "jose";

export const jwt = {
  issuer: "https://host.test",
  audience: "form-module",
  secret: "a test secret that is long enough for HS256",
};

/** The reference host's dev users that sign in to admin endpoints. */
export const devUsers = {
  "acme-admin": {
    sub: "acme-admin",
    tenant: "acme",
    capabilities: ["forms:manage", "responses:read", "responses:delete"],
  },
  "acme-analyst": { sub: "acme-analyst", tenant: "acme", capabilities: ["responses:read"] },
  "globex-admin": {
    sub: "globex-admin",
    tenant: "globex",
    capabilities: ["forms:manage", "responses:read", "responses:delete"],
  },
} satisfies Record<string, JWTPayload>;

export type DevUser = keyof typeof devUsers;

export interface TokenOptions {
  readonly secret?: string;
  readonly audience?: string;
  readonly expiresAt?: Date;
}

export const signToken = (claims: JWTPayload, options: TokenOptions = {}) =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(jwt.issuer)
    .setAudience(options.audience ?? jwt.audience)
    .setIssuedAt()
    .setExpirationTime(options.expiresAt ?? "5m")
    .sign(new TextEncoder().encode(options.secret ?? jwt.secret));

export const baseUrl = "http://localhost";

/** The API on a fresh PGlite database, served through a Fetch handler with the JWT resolver. */
export const startApi = () => {
  const { handler, dispose } = HttpRouter.toWebHandler(
    FormApiLive.pipe(
      Layer.provide(JwtActorResolver(jwt)),
      Layer.provide(DatabaseTest),
      Layer.provide(HttpServer.layerServices),
    ),
    { disableLogger: true },
  );
  const fetch = (request: Request) => handler(request);
  const clientWithToken = (getToken: () => string | null | Promise<string | null>): FormApiClient =>
    createFormApiClient({
      baseUrl,
      getToken,
      fetch: async (request) => fetch(await declareLength(request)),
    });
  return {
    fetch,
    dispose,
    clientWithToken,
    clientAs: (user: DevUser) => clientWithToken(() => signToken(devUsers[user])),
  };
};
