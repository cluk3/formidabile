# 34: Builder discards drafts, deletes never-published forms and changes settings

**What to build:** An editor discards the draft of a published form, deletes a form that was never published, changes a form's availability and response limit, and sees the form's external references. With ticket 33, this closes §12 bullet 1 end to end and bullet 3 through the UI.

**Sources:** [Spec, phase 3](../../form-builder-mvp/spec.md#phase-3-builder); [ADR 0014](../../../docs/adr/0014-only-never-published-forms-can-be-deleted.md), [ADR 0016](../../../docs/adr/0016-submissions-carry-a-client-minted-idempotency-key.md); [Form lifecycle: deleting or archiving forms](../../form-builder-mvp/issues/23-form-lifecycle-deleting-or-archiving-forms.md).

**Blocked by:** 12 (Delete never-published forms and change form settings), 24 (Forms carry external references), 32 (Builder edits and saves drafts).

**Status:** ready-for-agent

- [ ] An editor can discard the draft of a published form.
- [ ] On a never-published form, "Delete form", behind a confirmation step, replaces "Discard draft", and returns to the form list.
- [ ] Form settings have the availability toggle and the response limit.
- [ ] A form's external references are shown read-only.
- [ ] Unknown outcomes on these actions use the shared handling from ticket 31.
- [ ] Playwright, builder project: create a form, delete it, and check it's gone from the list.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
