# 38: Builder shows and deletes responses

**What to build:** In the builder, an admin browses a form's responses, opens one to see the questions and answers as they were in the version it was submitted under, and deletes responses when allowed. An analyst can read responses but can't publish or delete.

**Sources:** [Spec, phase 4](../../form-builder-mvp/spec.md#phase-4-responses-and-history) (`apps/builder`); ADR 0001 §8.1 in [ADR 0001](../../../docs/adr/0001-modular-versioned-form-management.md), [ADR 0013](../../../docs/adr/0013-personal-data-is-erased-by-hard-deletion-under-pseudonymous-subjects.md).

**Blocked by:** 33 (Builder previews, publishes and shows publication history), 35 (Admins list and read responses), 36 (Hosts erase a respondent's responses).

**Status:** ready-for-agent

- [ ] The response list has keyset paging and filters.
- [ ] Response detail is rebuilt from the embedded version as a read-only question-and-answer list. It's driven by each question type's display part in the builder registry through `interpretAnswers`, and doesn't reuse the renderer.
- [ ] Both deletes are available only with `responses:delete`.
- [ ] Playwright, builder project: open a v1 response after v2 is published and see v1's questions.
- [ ] Playwright, builder project: `acme-analyst` reads responses but can't publish or delete.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
