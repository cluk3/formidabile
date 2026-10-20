# ADR-014: Only never-published forms can be deleted

- **Status:** Accepted
- **Date:** 2026-10-20

A form that has never been published can be hard-deleted, with its draft and its external references. A form with any published version is permanent, even with no responses, and closing it is the only way to retire it. A never-published form has no versions, question identities or responses, so there's nothing for ADR-001 §5 to protect. A published form's versions are its publication history, and hosts may hold its id in embeds and anonymous grants. This amends ADR-007, whose trigger rejected every form deletion, and ADR-010, which gains `DELETE /forms/{formId}` and an eighth 409 tag. ADR-001 says nothing about deleting forms, and its line that disabling a form must not require deleting its versions or responses still holds.

The calls a reader is most likely to "fix" by mistake:

- **The trigger checks for versions, not the pointer.** A `BEFORE DELETE` row trigger on `forms` rejects the delete when any `form_versions` row has that `form_id`. The `TRUNCATE` rejection on `forms` stays, and so do the unconditional `form_versions` triggers. `drafts` and `form_external_refs` cascade from `forms`.
- **Discarding the draft of a never-published form is refused** with `FormNotPublished`. Deleting the form is the only way out, so a form always has a draft, a published version, or both, and never neither.
- **Deleting needs `expectedRevision`**, the draft's revision, so a stale admin can't delete another admin's newer edits. The use case locks the form row `FOR UPDATE`, as publish does. The checks run `NotFound`, then `FormPublished`, then `RevisionConflict`, because once someone else has published, "it's published now" is the useful answer.
- **There's no archived state.** Retired forms stay in the form list as closed forms. An archive flag would be a second hide-from-list axis next to availability. It's additive later, as a column and a list filter, if the list ever grows too long.

## Considered options

- **Deleting published forms that have no responses.** Rejected: it needs an exception in the `form_versions` trigger, erases publication history and breaks host embeds that hold the form id.
- **Soft deletion of never-published forms.** Rejected: nothing about them needs keeping, and a flag would leak into every form query.
- **Discarding the last draft deletes the form.** Rejected: one endpoint would quietly do two different things.
