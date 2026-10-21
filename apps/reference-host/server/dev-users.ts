import { SignJWT } from "jose";

// Dev tokens only: the HS256 secret is public by design.
export const devJwt = {
  issuer: "reference-host",
  audience: "form-module",
  secret: "reference-host-dev-secret",
};

const admin = ["forms:manage", "responses:read", "responses:delete"] as const;

/** The fixed dev users a developer signs in as. Anyone not signed in is the anonymous user. */
export const devUsers = {
  "acme-admin": { tenant: "acme", capabilities: admin },
  "acme-analyst": { tenant: "acme", capabilities: ["responses:read"] },
  "globex-admin": { tenant: "globex", capabilities: admin },
  alice: { tenant: "acme", capabilities: [] },
  bob: { tenant: "acme", capabilities: [] },
} as const satisfies Record<
  string,
  { readonly tenant: string; readonly capabilities: ReadonlyArray<string> }
>;

export type DevUser = keyof typeof devUsers;

export const isDevUser = (name: string): name is DevUser => Object.hasOwn(devUsers, name);

const secret = new TextEncoder().encode(devJwt.secret);

/** A tenant-wide identified token for a dev user, signed with the dev secret. */
export const mintDevToken = (user: DevUser) => {
  const { tenant, capabilities } = devUsers[user];
  return new SignJWT({ tenant, capabilities: [...capabilities] })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user)
    .setIssuer(devJwt.issuer)
    .setAudience(devJwt.audience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secret);
};
