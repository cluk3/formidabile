# 15: Reference host serves the API to dev users

**What to build:** The reference host mounts the module's Fetch handler at `/api` with the HS256 dev secret, and lets a developer sign in as a fixed dev user and get a token for them. This is the API the builder and e2e tests use.

**Sources:** [Spec, phase 1](../../form-builder-mvp/spec.md#phase-1-author-and-publish-through-the-api) (`apps/reference-host`); [ADR 0006](../../../docs/adr/0006-host-signed-bearer-tokens-and-module-enforced-capabilities.md); [Identity, authorization and tenancy seam](../../form-builder-mvp/issues/09-identity-authorization-and-tenancy-seam.md), [Package layout](../../form-builder-mvp/issues/11-package-layout.md).

**Blocked by:** 10 (Tracer bullet: an admin creates, lists and reads forms over HTTP).

**Status:** ready-for-agent

- [x] `/api` is served through the handler with the dev secret, both in dev and in `vp preview`.
- [x] `/login` is a dev user switcher that sets a cookie, for the fixed users `acme-admin`, `acme-analyst`, `globex-admin`, `alice`, `bob` and anonymous.
- [x] `/token` mints a tenant-wide identified JWT with `jose` for the signed-in dev user, and gives 401 for the anonymous user, because a grant needs `form`. There is no `project` parameter yet.
- [x] The CORS list allows the builder's origin.
- [x] Reference host Vitest: `/token` mints the expected claims for each dev user, gives 401 for the anonymous user, and an `acme-admin` token creates a form through `/api`.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t15-reference-host-api`. The last box stays open until the PR's CI jobs report. Notes for later tickets:

- `apps/reference-host/server/dev-users.ts` exports `devJwt` (issuer `reference-host`, audience `form-module`, the public HS256 secret), `devUsers` (tenant and capabilities per user: `acme-admin`, `acme-analyst`, `globex-admin` in their tenants, `alice` and `bob` in `acme` with no capabilities), `DevUser`, `isDevUser` and `mintDevToken(user)` (five-minute identified token, claims `sub`, `tenant`, `capabilities`, `iss`, `aud`, `iat`, `exp`). Ticket 17's seed should sign with these rather than copy them; ticket 25 extends `mintDevToken` or adds a grant minter next to it.
- `server/host.ts` `createReferenceHost(handler)` returns `{ serves(pathname), fetch, dispose }`, a plain Fetch app the plugin mounts and the Vitest drives in-process (`tests/host.test.ts`, PGlite through `HttpRouter.toWebHandler`). New host routes (`/token?project=`, the admin page's server side) go in its `fetch` and `serves`.
- `/api/...` loses its prefix before the module's handler sees it, so the builder's `apiBaseUrl` `http://localhost:4173/api` works unchanged. The host calls `handler.migrate()` once, before its first `/api` request (retried if it fails), so `vp build` still opens no pool, and every `/api` request now needs Postgres up.
- `/login`: `GET` is a plain-HTML switcher (no inline style or script, so fine under the preview CSP); `POST` (form fields `user`, optional `return`) sets `dev-user=<user>; HttpOnly; SameSite=Lax`, or clears it for `anonymous` or an unknown name, then 303s to `return` (only a path on this host or a `http://localhost:4174/` URL, else `/`). The builder's "Sign in" link can be `<loginUrl>?return=<builder url>`.
- `GET /token` answers `{ token }`, or 401 `{ error }` for anonymous. It sends `access-control-allow-origin: http://localhost:4174` with credentials when the request comes from the builder; the cookie is sent cross-port because both ports are the same site. `/api` gets the same origin through the handler's `cors` option (`builderOrigin` in `host.ts`).
