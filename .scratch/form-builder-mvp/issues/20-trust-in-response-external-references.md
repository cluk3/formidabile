# Trust in response external references

Type: grilling
Status: resolved
Blocked by: 19
Map: [Form builder MVP](../map.md)

## Question

Are a response's external references facts the host asserts, or labels the respondent's browser supplies?

Today the browser supplies them:

- [Frontend framework and renderer embedding strategy](./06-frontend-framework-and-renderer-embedding-strategy.md) makes "optional external references" a renderer input.
- [HTTP API surface](./16-http-api-surface.md) takes `externalRefs` in the body of `POST /respond/forms/{formId}/responses`.

Yet hosts are meant to rely on them. Phase 4 of the spec lists responses by reference for each demo project, and [Persistence model](./10-persistence-model.md) says the host needs that lookup to enforce limits scoped by reference. A respondent can edit the request and attach any project or workflow they like.

Options to weigh:

- Carry the references inside the host-signed context chosen in [Anonymous respondent access and tenancy](./19-anonymous-respondent-access-and-tenancy.md), so the module only accepts references the host signed. That context is now a JWT: an anonymous grant bound to one form, or an identified token that is tenant-wide (ADR 0011). Both are minted by the host per request through `getToken({ formId })`.
- Let the host attach references from its back-end after submission, or through a host-only endpoint.
- Keep them client-supplied, and document them as untrusted labels that hosts must never use for authorization or workflow decisions.

Decide also how `docs/embedding.md` states the guarantee, which ADRs and tickets change, and the test that proves a forged reference is rejected (or is visibly untrusted).

## Answer

Recorded as [ADR 0012](../../../docs/adr/0012-response-references-are-host-signed-claims.md), which amends [ADR 0002](../../../docs/adr/0002-mvp-product-calls.md), [ADR 0006](../../../docs/adr/0006-host-signed-bearer-tokens-and-module-enforced-capabilities.md), [ADR 0010](../../../docs/adr/0010-respondent-api-split-and-host-owned-lookups.md) and [ADR 0011](../../../docs/adr/0011-anonymous-respondents-hold-host-signed-form-bound-grants.md) with inline notes. ADR 0001 §4.5 already says references are "supplied through the integration boundary", so it's unchanged. **External reference** in `GLOSSARY.md` gains one sentence: a response's references are asserted by the host, never by the respondent. Amendment notes were added to [Frontend framework and renderer embedding strategy](./06-frontend-framework-and-renderer-embedding-strategy.md), [Identity, authorization and tenancy seam](./09-identity-authorization-and-tenancy-seam.md), [Persistence model](./10-persistence-model.md), [HTTP API surface](./16-http-api-surface.md) and [Anonymous respondent access and tenancy](./19-anonymous-respondent-access-and-tenancy.md). The spec is left for [Revise the phased plan and spec](./30-revise-the-phased-plan-and-spec.md).

- **Source: a host-signed claim.** Both claim sets (the identified token and the anonymous grant) may carry an optional `refs` claim, and the module stores the `refs` of the token that submitted, atomically with the response. `externalRefs` is removed from the submit body and from the renderer's inputs, so the browser can't supply a reference. Rejected: the host attaching references after submission (the list becomes mutable, isn't atomic, and the host can't verify an anonymous response id), client-supplied labels (useless to hosts, and contrary to ADR 0001 §4.5), and dropping response references (ADR 0001 §4.5 and §8.1 ask for them).
- **Optional and fixed**: a response may have no references. Only submit reads `refs`, and an edit never changes the stored references, even when its token carries different ones.
- **Form binding**: `refs` requires `form`. Identified tokens gain an optional `form` claim, required alongside `refs`. A form-bound token reaches only that form and its responses, and anything else gives 404, the same as an anonymous grant. This stops a tenant-wide token being replayed on another form under references the host meant for this one.
- **Claim validation**: `refs` holds at most 20 `{ namespace, refId }` entries. Each entry follows the [Persistence model](./10-persistence-model.md) shape limits (`namespace` 1 to 64 characters matching `^[a-z][a-z0-9_.-]*$`, `ref_id` 1 to 255) and has no extra keys. Each of these gives 401 `invalid`: more than 20 entries, a duplicate entry, a bad shape, or `refs` without `form`. An empty array means no references.
  - Amended by [Request limits and abuse controls](./25-request-limits-and-abuse-controls.md) (ADR 0015): the lengths count Unicode code points. A `refs` claim near these limits can exceed common 8 to 16 KiB header limits, so `docs/embedding.md` tells hosts to keep references short.
- **Bodies**: the submit and edit payloads reject unknown keys, so `externalRefs` in a body gives 422 `ValidationFailed` and nothing is stored. The submit body is `{ versionId, answers }`.
- **Actor**: `Identified { subject, tenant, capabilities, formId: Option, refs }` or `Anonymous { tenant, formId, refs }`, with `refs` empty when there are none. A custom `ActorResolver` fills them in, so in-process hosts assert references in their own code.
- **Reference host**: `/token?project=<id>` checks on the server that the project belongs to the signed-in dev user's tenant, and refuses otherwise. It then mints `form` (the form the server looked up for that project) and `refs: [{ namespace: "project", refId: <id> }]`, for anonymous and identified dev users alike. Without `project`, identified users get a tenant-wide token with no `refs`. The `{ formId }` passed to `getToken` never picks the form. The demo seed signs the same claims when it creates responses.
  - Clarified by [Lookup cardinality for form external references](./21-lookup-cardinality-for-form-external-references.md): "the form the server looked up" is the single candidate from `resolveProjectForm`, which the page route shares. With zero or several candidates, `/token` gives 404.
- **`docs/embedding.md`** states:
  - A response's external references are host assertions. The module stores the `refs` claim of the token that submitted, and nothing from the browser.
  - A host may rely on them in its workflows, within one limit: anyone holding that token before `exp` can submit to its form under those references. Keep tokens that carry `refs` short-lived.
  - Custom renderers never send `externalRefs`, and a body that includes it gets a 422.
- **Tests**: all are `http-api` integration tests (PGlite, JWT adapter with a test secret):
  1. A token with `form` and `refs` submits, and the stored references equal the claim. Listing responses by that reference finds the response.
  2. A body with `externalRefs` gives 422 `ValidationFailed`, and nothing is stored.
  3. Each of these gives 401 `invalid`: `refs` without `form`, more than 20 entries, a duplicate entry, a bad shape, or an extra key.
  4. An identified token bound to form A gives 404 when used to load or submit to form B, or to read one of B's responses.
  5. An edit with a token carrying different `refs` leaves the stored references unchanged.
  6. An empty `refs` array stores no references.
  7. A custom `ActorResolver` that returns `refs` gets them stored.

  There's no Playwright forgery test, because the lowest layer that can break is the API. The existing "form for project X" e2e test adds a check that the response is listed under its project.
