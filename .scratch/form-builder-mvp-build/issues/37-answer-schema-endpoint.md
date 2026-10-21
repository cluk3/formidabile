# 37: Answer-schema endpoint for custom renderers

**What to build:** A host writing its own renderer fetches a version's answer schema as JSON Schema, for optional browser validation. The server stays authoritative. The schema is generated on every request and proven to agree with the server's own validation, except for the documented date-range gap.

**Sources:** [Spec, phase 4](../../form-builder-mvp/spec.md#phase-4-responses-and-history); [ADR 0010](../../../docs/adr/0010-respondent-api-split-and-host-owned-lookups.md), [ADR 0011](../../../docs/adr/0011-anonymous-respondents-hold-host-signed-form-bound-grants.md); [HTTP API surface](../../form-builder-mvp/issues/16-http-api-surface.md), [Anonymous respondent access and tenancy](../../form-builder-mvp/issues/19-anonymous-respondent-access-and-tenancy.md).

**Blocked by:** 18 (Answer schemas for all seven question types), 23 (Anonymous respondents submit under a form-bound grant), 30 (Host-facing embedding guide).

**Status:** ready-for-agent

- [x] The answer-schema endpoint in the `/respond` group generates JSON Schema with `z.toJSONSchema` on every request, with the three generator fixes (`pattern: "\\S"`, `uniqueItems`, and `x-fb-minDate`/`x-fb-maxDate`), `maxLength: 254` on email, `x-fb-authoritative: false`, and the authority `description`.
- [x] An anonymous grant reaches the endpoint for its bound form, and a grant for form A gets 404 on form B's answer schema.
- [x] A table-driven contract test runs every case through Zod and through ajv (2020-12, with formats), including the 254 and 255 code-point email cases. The two may differ only on the date-range case.
- [x] The embedding guide's custom-renderer contract gains item 3: optional browser validation through this endpoint, with the date-range gap listed.
- [x] `openapi.json` and the client are regenerated.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t37-answer-schema`. The last box stays open until the PR's CI jobs report. Notes for later tickets:

- `Submission.version(actor, formId, versionId)` (`@fb/server`) gives any version's `FormDefinition` of a form the actor may load: `reaches(actor, formId)` first (a grant or a token with `form` reaches only its bound form, else 404), then 404 for a missing form or a version that isn't the form's, and 409 `FormClosed` for a closed form. Superseded versions are still served (an edit validates on the response's version).
- `GET /respond/forms/{formId}/versions/{versionId}/answer-schema` (operation `respond.answerSchema`) returns `answerJsonSchema(definition)` from `packages/http-api/lib/answer-schema.ts`: Zod's `toJSONSchema` (2020-12, `io: "input"`, `$schema` kept) plus per-question fixes keyed by question type, a top-level `description` and `x-fb-authoritative: false`. Email's `maxLength: 254` comes from core's own check, not the generator. The OpenAPI component is `AnswerSchema` (`Schema.JsonObject`), typed loosely in the client.
- The contract test is `packages/http-api/tests/answer-schema.test.ts`: one form with all seven types, the schema fetched over HTTP, every case through `validateAnswers` and ajv. Adding a question type means adding its cases there (and a fix in `answerJsonSchema` if its Zod schema uses a `refine` or a transform). ajv is a dev dependency of `@fb/http-api` only; under nodenext, `ajv-formats` is called as `formats.default(ajv)`.
