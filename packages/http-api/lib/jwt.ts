import { Actor, ActorResolver, Capability, TenantId, Unauthenticated } from "@fb/server/actor";
import { Effect, Layer, Option, Schema } from "effect";
import { createRemoteJWKSet, type JWTVerifyResult, jwtVerify } from "jose";

/** The host signs tokens with an HS256 shared secret, or with a key published at a JWKS URL. */
export type JwtOptions = { readonly issuer: string; readonly audience: string } & (
  | { readonly secret: string }
  | { readonly jwksUrl: string }
);

const IdentifiedClaims = Schema.Struct({
  sub: Schema.String,
  tenant: Schema.String,
  capabilities: Schema.Array(Capability),
});

const decodeIdentifiedClaims = Schema.decodeUnknownEffect(IdentifiedClaims);

const bearerToken = /^Bearer +([^ ]+) *$/i;

const invalid = () => new Unauthenticated({ reason: "invalid" });

/** The built-in `ActorResolver`: a host-signed JWT, checked against the configured issuer and audience. */
export const JwtActorResolver = (options: JwtOptions) => {
  const checks = { issuer: options.issuer, audience: options.audience, requiredClaims: ["exp"] };
  let verify: (token: string) => Promise<JWTVerifyResult>;
  if ("secret" in options) {
    const secret = new TextEncoder().encode(options.secret);
    verify = (token) => jwtVerify(token, secret, { ...checks, algorithms: ["HS256"] });
  } else {
    const keys = createRemoteJWKSet(new URL(options.jwksUrl));
    verify = (token) => jwtVerify(token, keys, checks);
  }
  return Layer.succeed(ActorResolver, {
    resolve: (request) => {
      const authorization = request.headers.authorization;
      if (authorization === undefined)
        return Effect.fail(new Unauthenticated({ reason: "missing" }));
      const token = bearerToken.exec(authorization)?.[1];
      if (token === undefined) return Effect.fail(invalid());
      return Effect.tryPromise({ try: () => verify(token), catch: invalid }).pipe(
        Effect.flatMap(({ payload }) => decodeIdentifiedClaims(payload)),
        Effect.mapError(invalid),
        Effect.map((claims) =>
          Actor.Identified({
            subject: claims.sub,
            tenant: TenantId.make(claims.tenant),
            capabilities: claims.capabilities,
            formId: Option.none(),
            refs: [],
          }),
        ),
      );
    },
  });
};
