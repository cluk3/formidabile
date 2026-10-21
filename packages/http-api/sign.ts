import { SignJWT, type JWTPayload } from "jose";

export type { JWTPayload };

export interface Hs256Options {
  readonly secret: string;
  readonly issuer: string;
  readonly audience: string;
  /** A `Date`, or a jose span such as `"5m"`. Defaults to five minutes. */
  readonly expiresAt?: Date | string;
}

/** An HS256 token `JwtActorResolver` accepts when issuer, audience and expiry match. */
export const signHs256 = (claims: JWTPayload, options: Hs256Options): Promise<string> =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(options.issuer)
    .setAudience(options.audience)
    .setIssuedAt()
    .setExpirationTime(options.expiresAt ?? "5m")
    .sign(new TextEncoder().encode(options.secret));
