# 40: Per-question analytics across versions (API)

**What to build:** Admins with `responses:read` get a form's analytics: one combined view per question identity across every version, plus a per-version breakdown. Questions that differ between versions are handled correctly. Analytics are computed on read, with no schema change.

**Sources:** [Spec, phase 5](../../form-builder-mvp/spec.md#phase-5-analytics); ADR 0001 §8.2 in [ADR 0001](../../../docs/adr/0001-modular-versioned-form-management.md), [ADR 0009](../../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md); [Analytics queries and cross-version compatibility](../../form-builder-mvp/issues/15-analytics-queries-and-cross-version-compatibility.md).

**Blocked by:** 36 (Hosts erase a respondent's responses).

**Status:** ready-for-agent

- [ ] The six fixed per-form queries run in one `REPEATABLE READ READ ONLY` transaction.
- [ ] Pure merge functions combine every snapshot of one question identity, and report changed options, labels and constraints as structured data.
- [ ] A question is "present" in a version (with responses, answered and skipped counts) or "absent", never zero-filled. An option's share is measured against the versions that offered it.
- [ ] The views are option counts, boolean splits, number count, min, max, mean and median, and only answered and skipped counts for text, email and date.
- [ ] The `analytics` group returns the `FormAnalytics` body with no prose. A never-published form returns empty, not 404.
- [ ] Merge-function unit tests on fixtures cover a dropped question, an added option, a relabelled option, a changed number range and a reidentified question, plus absent against skipped, and option shares against only the versions that offered the option.
- [ ] Query tests run on PGlite. `http-api` tests cover the empty form, `responses:read`, and cross-tenant access.
- [ ] The erasure tests gain analytics assertions. After deleting by respondent, analytics succeed for every affected form and their counts drop by exactly the deleted responses. After the last response of a version is deleted, analytics still list that version, with its questions present and zero counts.
- [ ] `openapi.json` and the client are regenerated.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
