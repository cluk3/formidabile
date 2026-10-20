# Expected load and data volumes

Type: grilling
Status: resolved
Map: [Form builder MVP](../map.md)

## Question

What scale must the MVP hold? No artifact states one, so the choices that depend on it can't be judged:

- `GET /forms` is unpaginated ([HTTP API surface](./16-http-api-surface.md)).
- The answer-schema endpoint caches one schema per version in process memory, with no bound.
- Analytics run six queries over every response of a form on each read, with no caching ([Analytics queries and cross-version compatibility](./15-analytics-queries-and-cross-version-compatibility.md)).
- Forms and versions are never deleted ([ADR 0002](../../../docs/adr/0002-mvp-product-calls.md)). Amended by [Form lifecycle: deleting or archiving forms](./23-form-lifecycle-deleting-or-archiving-forms.md): only never-published forms can be deleted, and there's no archive, so every published form stays in the form list for ever.

Decide:

- Target maxima, or an explicit "demo scale only": forms per tenant, versions per form, responses per form, and concurrent submitters.
- Whether `GET /forms` gets pagination now.
- Whether the answer-schema cache is bounded, and how.
- An analytics latency budget at the target volume, and whether computing on read still holds.
- Whether any test proves the targets, or the targets are only recorded as assumptions.

## Answer

Demo scale only. No ADR, because none of this is hard to reverse.

- **Envelope**: design assumptions, not guarantees. They go in the spec and in `docs/embedding.md`.
  - At most 10 tenants, 100 forms per tenant, 50 versions per form, 10,000 responses per form, and 20 people submitting at the same moment across the instance.
  - The model's own caps stay as [ADR 0005](../../../docs/adr/0005-form-definition-model.md) sets them: 200 questions per definition and 10,000 characters per text answer.
  - Published forms can't be deleted or archived ([Form lifecycle: deleting or archiving forms](./23-form-lifecycle-deleting-or-archiving-forms.md)), so they count toward the 100 forms for good.
- **Advisory, not enforced**: the module refuses nothing because of the envelope. A 101st form, a 51st version or a 10,001st response still works; going past the envelope is unsupported, not refused, and `docs/embedding.md` says so. There's no new error tag. Body sizes and claim lengths belong to [Request limits and abuse controls](./25-request-limits-and-abuse-controls.md).
- **Pagination**: none added. `GET /forms` (at most 100 summaries, roughly 40 KB) and `GET /forms/{formId}/versions` (at most 50) stay unpaginated. A cursor can still be added later without breaking clients. The response list keeps its keyset pagination.
- **No per-version caches**: `buildAnswerSchema` in `@fb/core` and the answer-schema endpoint's `z.toJSONSchema` in `@fb/http-api` are both built on every request. Building takes about 2 ms for a 200-question form ([Zod 4 alongside Effect Schema](./04-zod-4-alongside-effect-schema.md)), which is small next to the request's database round trips, and dropping the caches removes their unbounded memory growth. Revisit only if profiling shows a cost. This amends [Canonical form definition model](./08-canonical-form-definition-model.md) and [HTTP API surface](./16-http-api-surface.md).
- **Analytics**: still computed on read, as [Analytics queries and cross-version compatibility](./15-analytics-queries-and-cross-version-compatibility.md) decided, with no caching, materialised views or new indexes.
  - Budget (an estimate, not measured): about 1 second on a development laptop for a typical form at the envelope, 20 questions × 10,000 responses (about 200,000 answer rows).
  - The worst case, 200 questions × 10,000 responses (about 2 million rows), may take several seconds. That's accepted at demo scale.
- **Proof**: none. The envelope and the budget are recorded assumptions, with no load, volume or timing test, because a timing test on shared CI runners would fail at random and the spec accepts only automated exit criteria.
- **Map**: the "Performance work the load targets may demand" fog clears with no new tickets. [Revise the phased plan and spec](./30-revise-the-phased-plan-and-spec.md) folds this into `spec.md`, which currently says "cached per version" in phase 2 (`@fb/core` `answers`) and phase 4 (the answer-schema endpoint), and doesn't yet state the envelope.
