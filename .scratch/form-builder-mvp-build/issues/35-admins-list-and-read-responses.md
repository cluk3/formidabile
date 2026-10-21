# 35: Admins list and read responses against their versions

**What to build:** Admins with `responses:read` list their tenant's responses and read each one against the form version it was submitted under. Historical answers stay interpretable after later versions change the questions.

**Sources:** [Spec, phase 4](../../form-builder-mvp/spec.md#phase-4-responses-and-history); ADR 0001 §8.1 in [ADR 0001](../../../docs/adr/0001-modular-versioned-form-management.md), [ADR 0010](../../../docs/adr/0010-respondent-api-split-and-host-owned-lookups.md) (`responses` group), [ADR 0013](../../../docs/adr/0013-personal-data-is-erased-by-hard-deletion-under-pseudonymous-subjects.md) (access requests); [HTTP API surface](../../form-builder-mvp/issues/16-http-api-surface.md), [Request limits and abuse controls](../../form-builder-mvp/issues/25-request-limits-and-abuse-controls.md).

**Blocked by:** 21 (Submissions are safe to retry), 22 (Respondents edit their own response), 24 (Forms carry external references).

**Status:** ready-for-agent

- [x] The list is newest first, with keyset pagination on `id`, and a `limit` of 50 by default and 200 at most. Every filter is optional: form, version, external reference and respondent.
- [x] Reading a response embeds its form version.
- [x] A `respondentId` must be 1 to 255 code points, using the shared check: a 256-code-point `respondentId` gives 422.
- [x] Use case and `http-api`: reading a v1 response after v2 dropped one of its questions and relabelled an option returns v1's snapshots and the raw answers.
- [x] Use case and `http-api`: pagination is stable across edits.
- [x] Use case and `http-api`: filtering by `respondentId` with no `formId` lists that respondent's responses across every form in the tenant, and none from another tenant.
- [x] Use case and `http-api`: listing by reference finds a response submitted under that `refs` claim.
- [x] `http-api`: reading responses without `responses:read` gives 403, and another tenant's admin gets 404.
- [x] `openapi.json` and the client are regenerated.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t35-list-responses`. The last box stays open until the PR's CI jobs report. Notes for later tickets (36, 38 and 39 especially):

- `@fb/server` exports the `Responses` service (`lib/responses/responses.ts`, in `FormModuleLive`): `list(actor, { formId?, versionId?, ref?, respondentId?, cursor?, limit? })` gives `ResponsePage` (`{ responses: ResponseSummary[], nextCursor }`) and `read(actor, responseId)` gives `ResponseDetail` (`{ response: { ...ResponseSummary, answers }, version: { id, number, definition } }`). `ResponseSummary` is `{ id, formId, versionId, versionNumber, respondentId (null when anonymous), submittedAt, editedAt, externalRefs }`; the admin read has no `revision` (only the respondent's read carries it). Both need `responses:read` (`forms:manage` alone gives 403). Another tenant's response is `NotFound`; another tenant's filters just match nothing.
- Each call runs in one `REPEATABLE READ READ ONLY` transaction. The list orders by `id DESC`, fetches `limit + 1` rows and sets `nextCursor` to the page's last id only when more follow; the next page is `id < cursor`. The default limit (50) lives in the use case; the edge holds `limit` to an integer 1 to 200.
- HTTP, the `responses` group: `GET /responses` (query `formId`, `versionId`, `refNamespace` + `refId` together or neither, `respondentId`, `cursor`, `limit`) and `GET /responses/{responseId}`. `formId`, `versionId`, `cursor` and `responseId` are UUIDs at the edge. Ticket 36 adds its deletes to `ResponsesGroup`/`ResponsesHandlers` in `packages/http-api/lib/{api,handlers}.ts`.
- `@fb/server/actor` now exports `RespondentId`, the shared 1-to-255-code-point check. Ticket 36's `/respondents/{respondentId}/responses` path parameter should use it.
- The generated client types `limit` as a number: the list endpoint's `OpenApi.Transform` annotation rewrites that one parameter, because Effect documents query parameters by their string encoding.
- `api.ts` now shares the reference query fields (`RefQuery`) and the both-halves check (`refHalvesTogether`) between `GET /forms` and `GET /responses`.
