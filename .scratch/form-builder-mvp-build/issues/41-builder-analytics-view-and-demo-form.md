# 41: Builder analytics view and the multi-version demo form

**What to build:** In the builder, an admin sees a form's analytics: the combined result per question and the per-version breakdown. The demo seed gains a form whose versions exercise every cross-version case. With this ticket, every §12 bullet and every security case is closed.

**Sources:** [Spec, phase 5](../../form-builder-mvp/spec.md#phase-5-analytics) and [Seed data and the database lifecycle](../../form-builder-mvp/spec.md#seed-data-and-the-database-lifecycle); [ADR 0009](../../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md); [Analytics queries and cross-version compatibility](../../form-builder-mvp/issues/15-analytics-queries-and-cross-version-compatibility.md).

**Blocked by:** 33 (Builder previews, publishes and shows publication history), 40 (Per-question analytics across versions).

**Status:** ready-for-agent

- [x] The analytics view shows the combined result and the per-version breakdown as tables with plain CSS bars, and no chart library.
- [x] The seed adds one form in `acme` with versions that drop a question, add an option, relabel an option, change a number range and reidentify a question, with responses from `alice`, `bob` and anonymous respondents.
- [x] Playwright, builder project: on a multi-version form the test builds for itself, the view shows counts by version and keeps an absent question out of that version's totals.
- [x] Every row of the spec's §12 proof table and Security cases table has its tests.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t41-builder-analytics`. The last box stays open until the PR's CI jobs report. Notes:

- `/forms/[formId]/analytics` mounts `src/lib/FormAnalytics.svelte` (props `client`, `formId`, `signInHref`). It shows a "Responses by version" table, then one region per question (named by its label) with an "All versions" table (choice: chosen, share bar from `count / base`, offered-in versions and other labels, plus a note when options weren't offered in every version; yes/no: counts and shares; number: count, min, max, mean, median) and a "By version" table (responses, answered, skipped, the version's own result and allowed range, or "Not in this version" with no counts). Sentence and number helpers are in `src/lib/analytics.ts`. A 401, or a 403 for `responses:read`, asks to sign in; analysts see the view.
- Links: an "Analytics" link sits in the nav rows of the editor and responses pages, and beside "Responses" for each published form in the list.
- Tests: `apps/builder/tests/analytics.browser.test.ts`; e2e `e2e/builder/analytics.spec.ts`, which builds its own two-version form through the reference host.
- The seed's `seedVersions` publishes a list of definitions as successive versions of one open form, submitting each version's responses while it's current. Acme now has two forms: "Onboarding survey" (four versions: v2 drops "How did you find us?"; v3 adds "Very easy", relabels "OK" to "Manageable" and raises the hours maximum from 8 to 24; v4 reidentifies the text question "How big is your team?" through `reidentifyQuestion`, keeping its type under a new identity). Its responses come from `alice`, `bob` and anonymous grants bound to the form with no `refs`; it carries no project reference.
- Audit of the spec's §12 and Security cases tables: every row has its tests. This ticket added the two that were missing, both in `packages/http-api/tests/respond.test.ts`: an identified token bound to another tenant's form gets 404 (Security cases, row 6), and an edit under a token carrying different `refs` keeps the stored references (row 7, issue 20 test 5). Racing submissions are proven in `test:pg` only, as issue 26 decided; the use case, renderer and Playwright layers prove the retries.
