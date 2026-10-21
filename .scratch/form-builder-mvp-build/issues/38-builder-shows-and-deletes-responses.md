# 38: Builder shows and deletes responses

**What to build:** In the builder, an admin browses a form's responses, opens one to see the questions and answers as they were in the version it was submitted under, and deletes responses when allowed. An analyst can read responses but can't publish or delete.

**Sources:** [Spec, phase 4](../../form-builder-mvp/spec.md#phase-4-responses-and-history) (`apps/builder`); ADR 0001 §8.1 in [ADR 0001](../../../docs/adr/0001-modular-versioned-form-management.md), [ADR 0013](../../../docs/adr/0013-personal-data-is-erased-by-hard-deletion-under-pseudonymous-subjects.md).

**Blocked by:** 33 (Builder previews, publishes and shows publication history), 35 (Admins list and read responses), 36 (Hosts erase a respondent's responses).

**Status:** ready-for-agent

- [x] The response list has keyset paging and filters.
- [x] Response detail is rebuilt from the embedded version as a read-only question-and-answer list. It's driven by each question type's display part in the builder registry through `interpretAnswers`, and doesn't reuse the renderer.
- [x] Both deletes are available only with `responses:delete`.
- [x] Playwright, builder project: open a v1 response after v2 is published and see v1's questions.
- [x] Playwright, builder project: `acme-analyst` reads responses but can't publish or delete.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t38-builder-responses`. The last box stays open until the PR's CI jobs report. Notes for later tickets (41 especially):

- `createBuilderClient` now returns a `BuilderClient`: the `FormApiClient` plus `capabilities()`, which reads a fresh token's `capabilities` claim (`[]` without a usable token). The token gate now accepts `forms:manage` or `responses:read` (ADR 0010), so `acme-analyst` signs in; `outcome` still turns a 403 for `forms:manage` into `signIn`, so an analyst opening the editor sees the sign-in prompt and no Publish. `FormsPage` hides "Create form" without `forms:manage` and links each published form to "Responses". Use `capabilities()` to decide what a page offers (ticket 41's analytics needs only `responses:read` or `forms:manage`).
- The builder registry moved from `src/lib/editors/editors.ts` to `src/lib/registry.ts` (`registry`, `questionTypeNames`, `editorOf`, `answerOf`); each type has `name`, `editor` and `answer`. Answer displays live in `src/lib/answers/` and take `AnswerProps<T>` (`question`, typed `value`, core's `display` text) from `interpretAnswers`. Multiple choice lists each label (core's display joins with `, `, which a label may contain).
- `/forms/[formId]/responses` (`src/lib/ResponsesPage.svelte`, props `client: BuilderClient`, `formId`, `signInHref`): filters (version select from `GET /forms/{id}/versions`, respondent, reference namespace + id, both or neither), "Load more" through `nextCursor` with the applied filters, "Open" shows `src/lib/ResponseDetail.svelte` (region "Response from <respondent>" or "Anonymous response"), with "Delete response" and "Delete all responses from <respondent>" behind a "Delete permanently" confirmation, only with `responses:delete`. A delete-by-respondent reloads the first page; an unknown outcome reloads the list. The editor's route links "Responses"; the responses route links "All forms" and "Edit form".
- Tests: `apps/builder/tests/responses.browser.test.ts` (a stateful responses fake host with keyset paging and filters); `fakeHost(api, capabilities?)` in `tests/fake-host.ts` now mints a token with the given capabilities (exports `admin` and `analyst`). e2e `e2e/builder/responses.spec.ts` seeds through the host with `seedProject` from `e2e/renderer/projects.ts` on its own `playwright.request` context (baseURL 4173), submits as alice under `/token?project=`, then publishes v2.
