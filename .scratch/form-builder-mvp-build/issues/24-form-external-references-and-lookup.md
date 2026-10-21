# 24: Forms carry external references, and hosts look forms up by reference

**What to build:** Admins attach external references to a form and detach them, and a host finds every form in its tenant carrying a given reference. The module treats references as opaque `{ namespace, refId }` pairs. Choosing among several matches is the host's job.

**Sources:** [Spec, phase 2](../../form-builder-mvp/spec.md#phase-2-respond); [ADR 0002](../../../docs/adr/0002-mvp-product-calls.md), [ADR 0010](../../../docs/adr/0010-respondent-api-split-and-host-owned-lookups.md); [Lookup cardinality for form external references](../../form-builder-mvp/issues/21-lookup-cardinality-for-form-external-references.md), [HTTP API surface](../../form-builder-mvp/issues/16-http-api-surface.md).

**Blocked by:** 12 (Delete never-published forms and change form settings), 19 (Response and external-reference tables).

**Status:** ready-for-agent

- [x] Adding a reference is idempotent, and a form holds at most 100: the 101st gives `ExternalRefLimitReached`. Removing a missing reference is a no-op.
- [x] The form list's `refNamespace` and `refId` filter returns every matching form in the tenant, sorted by `updatedAt` descending. An unknown reference gives 200 with an empty list.
- [x] References are tested with arbitrary namespaces.
- [x] One reference on two forms in the tenant returns both, and the same reference in another tenant isn't returned.
- [x] Changing references without `forms:manage` gives 403.
- [x] `openapi.json` and the client are regenerated.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t24-form-refs`. The last box stays open until the PR's CI jobs report. Notes for later tickets (25 and 39 especially):

- HTTP, in the `forms` group: `POST /forms/{formId}/external-refs` (body `{ namespace, refId }`) and `DELETE /forms/{formId}/external-refs?namespace=&refId=`, both 200 `{ externalRefs }` with the form's whole set, `forms:manage` only. `GET /forms?refNamespace=&refId=` is the lookup; it takes both or neither (one alone gives 422), and any admin read (`forms:manage` or `responses:read`) may call it, so ticket 25's `responses:read` service token works. `FormDetail` now has `externalRefs`.
- `@fb/server/actor` now exports `ExternalRef` as an Effect Schema (namespace 1 to 64 code points matching `^[a-z][a-z0-9_.-]*$`, `refId` 1 to 255 code points), and the token `refs` check reuses it. A malformed reference gives 422 at the edge, on the lookup too.
- `Forms` gains `addExternalRef(actor, formId, ref)` and `removeExternalRef(actor, formId, ref)`, and `list(actor, ref?)`. Both writes lock the form row (`lockForm`), so concurrent adds can't pass the 100 limit; `@fb/server` exports `ExternalRefLimitReached` (409, `{ limit: 100 }`). Re-adding a held reference succeeds even at 100. Another tenant's form gives `NotFound`. Sets are sorted by namespace, then `refId`, byte-wise (`COLLATE "C"`), so both drivers agree.
- Changing references doesn't touch `forms.updated_at`: references are the host's associations, not an edit of the form, and attaching one shouldn't reorder the admin's list.
