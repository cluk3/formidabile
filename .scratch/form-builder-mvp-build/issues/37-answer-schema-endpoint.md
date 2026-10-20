# 37: Answer-schema endpoint for custom renderers

**What to build:** A host writing its own renderer fetches a version's answer schema as JSON Schema, for optional browser validation. The server stays authoritative. The schema is generated on every request and proven to agree with the server's own validation, except for the documented date-range gap.

**Sources:** [Spec, phase 4](../../form-builder-mvp/spec.md#phase-4-responses-and-history); [ADR 0010](../../../docs/adr/0010-respondent-api-split-and-host-owned-lookups.md), [ADR 0011](../../../docs/adr/0011-anonymous-respondents-hold-host-signed-form-bound-grants.md); [HTTP API surface](../../form-builder-mvp/issues/16-http-api-surface.md), [Anonymous respondent access and tenancy](../../form-builder-mvp/issues/19-anonymous-respondent-access-and-tenancy.md).

**Blocked by:** 18 (Answer schemas for all seven question types), 23 (Anonymous respondents submit under a form-bound grant), 30 (Host-facing embedding guide).

**Status:** ready-for-agent

- [ ] The answer-schema endpoint in the `/respond` group generates JSON Schema with `z.toJSONSchema` on every request, with the three generator fixes (`pattern: "\\S"`, `uniqueItems`, and `x-fb-minDate`/`x-fb-maxDate`), `maxLength: 254` on email, `x-fb-authoritative: false`, and the authority `description`.
- [ ] An anonymous grant reaches the endpoint for its bound form, and a grant for form A gets 404 on form B's answer schema.
- [ ] A table-driven contract test runs every case through Zod and through ajv (2020-12, with formats), including the 254 and 255 code-point email cases. The two may differ only on the date-range case.
- [ ] The embedding guide's custom-renderer contract gains item 3: optional browser validation through this endpoint, with the date-range gap listed.
- [ ] `openapi.json` and the client are regenerated.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
