# ADR-012: Response references are host-signed claims

- **Status:** Accepted
- **Date:** 2026-10-20

A response's external references are asserted by the host application, never supplied by the respondent's browser. The host puts them in the token it mints for the request, as an optional `refs` claim, and the module stores the `refs` of the token that submitted, atomically with the response. The submit body and the renderer have no way to supply references at all. Hosts rely on response references to drive their workflows (ADR-001 §3.2) and to find "the responses for project X", and ADR-001 §4.5 already says they are "supplied through the integration boundary". A reference the browser chose would let any respondent attach their response to any entity. This amends ADR-002, which had references supplied at submission without saying by whom, ADR-010, whose submit body carried `externalRefs`, and ADR-011, whose claim sets had no `refs` and gave identified tokens no `form`.

The calls a reader is most likely to "fix" by mistake:

- **A token that carries `refs` is bound to one form.** `refs` requires a `form` claim, so identified tokens gain an optional `form`, which is required alongside `refs`. A form-bound token reaches only that form and its responses, and anything else gives 404, the same as an anonymous grant. Without the binding, a respondent could replay a tenant-wide token on another form and tag that response with an entity the host meant only for this one.
- **`externalRefs` in a request body is rejected, not ignored.** The submit and edit bodies reject unknown keys with 422 `ValidationFailed`, so a stale client or a tampered request fails loudly instead of appearing to work.
- **The claim is validated as strictly as the rest of the token.** `refs` holds at most 20 `{ namespace, refId }` entries, with the reference shape limits from the persistence model and no extra keys. More than 20 entries, a duplicate entry, a bad shape, or `refs` without `form` gives 401 `invalid`. An empty array means no references. The shape limits count Unicode code points (amended 2026-10-20, see ADR-015).
- **The references are fixed when the response is submitted.** Only submit reads `refs`. An edit leaves the stored references alone, even when its token carries different ones.
- **The actor carries the claims, so custom resolvers assert them too.** The actor is `Identified { subject, tenant, capabilities, formId: Option, refs }` or `Anonymous { tenant, formId, refs }`. A custom `ActorResolver` fills in `refs` from the host's own code.
- **The guarantee has one stated limit.** Anyone holding a token before its `exp` can submit to its form under its references. Hosts should keep tokens that carry `refs` short-lived.

## Considered options

- **The host attaches references after submission**, through a service-token endpoint. Rejected: it makes the list mutable, leaves a response without references until the host acts, and the host can't check that the response id an anonymous respondent's browser reports is really theirs.
- **Client-supplied references, documented as untrusted labels.** Rejected: hosts couldn't use them for anything, which contradicts ADR-001 §4.5.
- **No response references in the MVP.** Rejected: ADR-001 §4.5 and §8.1 ask for them, and the reference host needs "responses by project".
- **`refs` on tenant-wide tokens.** Rejected for the replay reason above.
