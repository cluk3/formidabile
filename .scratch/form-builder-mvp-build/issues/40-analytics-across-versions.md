# 40: Per-question analytics across versions (API)

**What to build:** Admins with `responses:read` get a form's analytics: one combined view per question identity across every version, plus a per-version breakdown. Questions that differ between versions are handled correctly. Analytics are computed on read, with no schema change.

**Sources:** [Spec, phase 5](../../form-builder-mvp/spec.md#phase-5-analytics); ADR 0001 §8.2 in [ADR 0001](../../../docs/adr/0001-modular-versioned-form-management.md), [ADR 0009](../../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md); [Analytics queries and cross-version compatibility](../../form-builder-mvp/issues/15-analytics-queries-and-cross-version-compatibility.md).

**Blocked by:** 36 (Hosts erase a respondent's responses).

**Status:** ready-for-agent

- [x] The six fixed per-form queries run in one `REPEATABLE READ READ ONLY` transaction.
- [x] Pure merge functions combine every snapshot of one question identity, and report changed options, labels and constraints as structured data.
- [x] A question is "present" in a version (with responses, answered and skipped counts) or "absent", never zero-filled. An option's share is measured against the versions that offered it.
- [x] The views are option counts, boolean splits, number count, min, max, mean and median, and only answered and skipped counts for text, email and date.
- [x] The `analytics` group returns the `FormAnalytics` body with no prose. A never-published form returns empty, not 404.
- [x] Merge-function unit tests on fixtures cover a dropped question, an added option, a relabelled option, a changed number range and a reidentified question, plus absent against skipped, and option shares against only the versions that offered the option.
- [x] Query tests run on PGlite. `http-api` tests cover the empty form, `responses:read`, and cross-tenant access.
- [x] The erasure tests gain analytics assertions. After deleting by respondent, analytics succeed for every affected form and their counts drop by exactly the deleted responses. After the last response of a version is deleted, analytics still list that version, with its questions present and zero counts.
- [x] `openapi.json` and the client are regenerated.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t40-analytics`. The last box stays open until the PR's CI jobs report. Notes for ticket 41:

- `Analytics.form(actor, formId)` (needs `responses:read`; `NotFound` for an unknown or other tenant's form) and `GET /forms/{formId}/analytics` in the `analytics` group return `FormAnalytics` (`@fb/server` envelopes, `components.schemas.FormAnalytics` in the client). A never-published form gives 200 with `versions: []`, `questions: []`.
- Versions are referenced by `number`; `versions[]` (ascending) maps numbers to `versionId`, `publishedAt` and `responses`. `questions[]` is the current version's questions in its order, then dropped ones (`inCurrentVersion: false`), most recently dropped first.
- Each question has the latest `label` plus `otherLabels: [{ label, versions }]`, a `combined` view (`responses`, `answered`, `skipped`, `absentResponses` = responses of versions without it, `summary`) and `byVersion[]` with one entry per version: `{ version, present: false }` or `{ version, present: true, responses, answered, skipped, summary, constraints }`. Never render an absent version as zero or skipped.
- `summary` is tagged by `type`: choice types give `options[]` with `value`, `label`, `otherLabels`, `count`, `base`, `offeredIn`; the share is `count / base` (base counts only versions offering the option; guard `base === 0`). `boolean` gives `trueCount`/`falseCount`; `number` gives `count`, `min`, `max`, `mean`, `median` (null when `count` is 0); text, email and date give only `{ type }`. `constraints` is `{ type: "number", integer, min, max }`, `{ type: "multiple_choice", minSelected, maxSelected }`, or null: compare across `byVersion` to show changed ranges.
- A reidentified question is a separate entry; options match by `value`, never label.
