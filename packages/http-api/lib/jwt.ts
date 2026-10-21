import { Actor, ActorResolver, Capability, TenantId, Unauthenticated } from "@fb/server/actor";
import { Effect, Layer, Option, Schema } from "effect";
import { createRemoteJWKSet, type JWTVerifyResult, jwtVerify } from "jose";

/** The host signs tokens with an HS256 shared secret, or with a key published at a JWKS URL. */
export type JwtOptions = { readonly issuer: string; readonly audience: string } & (
  | { readonly secret: string }
  | { readonly jwksUrl: string }
);

// Registered claims (`iss`, `exp`, ...) and any the host adds pass through the index signature.
const OtherClaims = [Schema.Record(Schema.String, Schema.Unknown)] as const;

// Only the shape: `authenticate` holds every actor to the reference limits. Decoding rejects extra keys.
const Refs = Schema.Array(Schema.Struct({ namespace: Schema.String, refId: Schema.String }));

const IdentifiedClaims = Schema.StructWithRest(
  Schema.Struct({
    sub: Schema.String,
    tenant: Schema.String,
    capabilities: Schema.Array(Capability),
    form: Schema.optionalKey(Schema.String),
    refs: Schema.optionalKey(Refs),
    anonymous: Schema.optionalKey(Schema.Never),
  }),
  OtherClaims,
).check(
  // ADR 0012: `refs` binds the token to one form, even when it's empty.
  Schema.makeFilter((claims) => claims.refs === undefined || claims.form !== undefined, {
    expected: "form alongside refs",
  }),
);

const AnonymousClaims = Schema.StructWithRest(
  Schema.Struct({
    anonymous: Schema.Literal(true),
    tenant: Schema.String,
    form: Schema.String,
    refs: Schema.optionalKey(Refs),
    sub: Schema.optionalKey(Schema.Never),
    capabilities: Schema.optionalKey(Schema.Never),
  }),
  OtherClaims,
);

const decodeClaims = Schema.decodeUnknownEffect(Schema.Union([IdentifiedClaims, AnonymousClaims]), {
  onExcessProperty: "error",
});

const toActor = (claims: typeof IdentifiedClaims.Type | typeof AnonymousClaims.Type): Actor =>
  claims.anonymous === true
    ? Actor.Anonymous({
        tenant: TenantId.make(claims.tenant),
        formId: claims.form,
        refs: claims.refs ?? [],
      })
    : Actor.Identified({
        subject: claims.sub,
        tenant: TenantId.make(claims.tenant),
        capabilities: claims.capabilities,
        formId: Option.fromUndefinedOr(claims.form),
        refs: claims.refs ?? [],
      });

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
        Effect.flatMap(({ payload }) => decodeClaims(payload)),
        Effect.mapError(invalid),
        Effect.map(toActor),
      );
    },
  });
};
