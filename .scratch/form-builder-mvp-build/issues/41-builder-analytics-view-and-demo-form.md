# 41: Builder analytics view and the multi-version demo form

**What to build:** In the builder, an admin sees a form's analytics: the combined result per question and the per-version breakdown. The demo seed gains a form whose versions exercise every cross-version case. With this ticket, every §12 bullet and every security case is closed.

**Sources:** [Spec, phase 5](../../form-builder-mvp/spec.md#phase-5-analytics) and [Seed data and the database lifecycle](../../form-builder-mvp/spec.md#seed-data-and-the-database-lifecycle); [ADR 0009](../../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md); [Analytics queries and cross-version compatibility](../../form-builder-mvp/issues/15-analytics-queries-and-cross-version-compatibility.md).

**Blocked by:** 33 (Builder previews, publishes and shows publication history), 40 (Per-question analytics across versions).

**Status:** ready-for-agent

- [ ] The analytics view shows the combined result and the per-version breakdown as tables with plain CSS bars, and no chart library.
- [ ] The seed adds one form in `acme` with versions that drop a question, add an option, relabel an option, change a number range and reidentify a question, with responses from `alice`, `bob` and anonymous respondents.
- [ ] Playwright, builder project: on a multi-version form the test builds for itself, the view shows counts by version and keeps an absent question out of that version's totals.
- [ ] Every row of the spec's §12 proof table and Security cases table has its tests.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
