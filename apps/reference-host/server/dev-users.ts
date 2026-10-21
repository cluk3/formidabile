import { type JWTPayload, SignJWT } from "jose";

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

/** The dev tenants, each with at least one dev user. */
export const devTenants: ReadonlyArray<string> = [
  ...new Set(Object.values(devUsers).map(({ tenant }) => tenant)),
];

const secret = new TextEncoder().encode(devJwt.secret);

// Every token the host mints lasts five minutes.
const sign = (claims: JWTPayload) =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(devJwt.issuer)
    .setAudience(devJwt.audience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secret);

const identified = (user: DevUser) => {
  const { tenant, capabilities } = devUsers[user];
  return { sub: user, tenant, capabilities: [...capabilities] };
};

/** A tenant-wide identified token for a dev user, signed with the dev secret. */
export const mintDevToken = (user: DevUser) => sign(identified(user));

/** The host's own token for reading a tenant's forms, as no dev user. */
export const mintServiceToken = (tenant: string) =>
  sign({ sub: "reference-host", tenant, capabilities: ["responses:read"] });

export interface ExternalRef {
  readonly namespace: string;
  readonly refId: string;
}

/**
 * A token bound to one form and carrying the host's `refs`: an identified token for a dev user, or an anonymous
 * grant in the form's tenant for the anonymous user (`null`).
 */
export const mintFormToken = (
  user: DevUser | null,
  form: { readonly tenant: string; readonly id: string },
  refs: ReadonlyArray<ExternalRef>,
) =>
  sign({
    ...(user === null ? { anonymous: true, tenant: form.tenant } : identified(user)),
    form: form.id,
    refs: refs.map(({ namespace, refId }) => ({ namespace, refId })),
  });
