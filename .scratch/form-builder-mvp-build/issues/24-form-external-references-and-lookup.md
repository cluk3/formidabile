# 24: Forms carry external references, and hosts look forms up by reference

**What to build:** Admins attach external references to a form and detach them, and a host finds every form in its tenant carrying a given reference. The module treats references as opaque `{ namespace, refId }` pairs. Choosing among several matches is the host's job.

**Sources:** [Spec, phase 2](../../form-builder-mvp/spec.md#phase-2-respond); [ADR 0002](../../../docs/adr/0002-mvp-product-calls.md), [ADR 0010](../../../docs/adr/0010-respondent-api-split-and-host-owned-lookups.md); [Lookup cardinality for form external references](../../form-builder-mvp/issues/21-lookup-cardinality-for-form-external-references.md), [HTTP API surface](../../form-builder-mvp/issues/16-http-api-surface.md).

**Blocked by:** 12 (Delete never-published forms and change form settings), 19 (Response and external-reference tables).

**Status:** ready-for-agent

- [ ] Adding a reference is idempotent, and a form holds at most 100: the 101st gives `ExternalRefLimitReached`. Removing a missing reference is a no-op.
- [ ] The form list's `refNamespace` and `refId` filter returns every matching form in the tenant, sorted by `updatedAt` descending. An unknown reference gives 200 with an empty list.
- [ ] References are tested with arbitrary namespaces.
- [ ] One reference on two forms in the tenant returns both, and the same reference in another tenant isn't returned.
- [ ] Changing references without `forms:manage` gives 403.
- [ ] `openapi.json` and the client are regenerated.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
