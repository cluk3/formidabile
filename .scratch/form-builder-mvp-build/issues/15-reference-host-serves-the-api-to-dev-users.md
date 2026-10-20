# 15: Reference host serves the API to dev users

**What to build:** The reference host mounts the module's Fetch handler at `/api` with the HS256 dev secret, and lets a developer sign in as a fixed dev user and get a token for them. This is the API the builder and e2e tests use.

**Sources:** [Spec, phase 1](../../form-builder-mvp/spec.md#phase-1-author-and-publish-through-the-api) (`apps/reference-host`); [ADR 0006](../../../docs/adr/0006-host-signed-bearer-tokens-and-module-enforced-capabilities.md); [Identity, authorization and tenancy seam](../../form-builder-mvp/issues/09-identity-authorization-and-tenancy-seam.md), [Package layout](../../form-builder-mvp/issues/11-package-layout.md).

**Blocked by:** 10 (Tracer bullet: an admin creates, lists and reads forms over HTTP).

**Status:** ready-for-agent

- [ ] `/api` is served through the handler with the dev secret, both in dev and in `vp preview`.
- [ ] `/login` is a dev user switcher that sets a cookie, for the fixed users `acme-admin`, `acme-analyst`, `globex-admin`, `alice`, `bob` and anonymous.
- [ ] `/token` mints a tenant-wide identified JWT with `jose` for the signed-in dev user, and gives 401 for the anonymous user, because a grant needs `form`. There is no `project` parameter yet.
- [ ] The CORS list allows the builder's origin.
- [ ] Reference host Vitest: `/token` mints the expected claims for each dev user, gives 401 for the anonymous user, and an `acme-admin` token creates a form through `/api`.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
