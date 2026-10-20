# 31: Builder signs in, lists and creates forms

**What to build:** An editor opens the builder, signs in through the host application, sees their tenant's forms, and creates a new one. This ticket also sets up the builder's shared handling of unknown outcomes, which later builder tickets reuse.

**Sources:** [Spec, phase 3](../../form-builder-mvp/spec.md#phase-3-builder); [ADR 0003](../../../docs/adr/0003-svelte-renderer-with-two-outputs.md), [ADR 0016](../../../docs/adr/0016-submissions-carry-a-client-minted-idempotency-key.md) (the builder's unknown outcomes); [Identity, authorization and tenancy seam](../../form-builder-mvp/issues/09-identity-authorization-and-tenancy-seam.md) (the builder admin actor), [Frontend framework and renderer embedding strategy](../../form-builder-mvp/issues/06-frontend-framework-and-renderer-embedding-strategy.md).

**Blocked by:** 05 (Builder SPA shell), 15 (Reference host serves the API to dev users).

**Status:** ready-for-agent

- [ ] The admin actor comes from `config.json`. The builder calls `GET <tokenUrl>` with `credentials: "include"` before each API call, and shows a "Sign in" link to `<loginUrl>` on a 401 or when `forms:manage` is missing.
- [ ] The form list shows the tenant's forms, and an editor can create a form.
- [ ] On an unknown outcome, the builder says it couldn't confirm the action and reloads: the form list after a create, or the form's detail otherwise.
- [ ] Component test: an unknown outcome on create reloads the form list.
- [ ] Playwright, builder project: signed in as `acme-admin`, create a form and find it in the list by title.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
