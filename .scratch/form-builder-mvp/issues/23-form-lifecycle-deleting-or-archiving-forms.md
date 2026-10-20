# Form lifecycle: deleting or archiving forms

Type: grilling
Status: resolved
Blocked by: 18
Map: [Form builder MVP](../map.md)

## Question

Can any form ever leave the form list?

- [ADR 0002](../../../docs/adr/0002-mvp-product-calls.md): forms are closed, never deleted. [ADR 0007](../../../docs/adr/0007-answer-rows-and-trigger-enforced-persistence-invariants.md): a trigger rejects deleting any form.
- That includes a form created by mistake and never published, which has no version and no responses to protect.
- [HTTP API surface](./16-http-api-surface.md): `GET /forms` is unpaginated, so every abandoned form stays in every list for ever.
- The spec's `seed:reset` has to drop the whole schema because forms can't be deleted.
- [Personal data classification and erasure](./22-personal-data-classification-and-erasure.md) (ADR 0013) treats form content as non-personal by contract and leaves removing a whole form to this ticket. Erasure of responses doesn't depend on the answer here.

Decide:

- Whether a form that was never published (or has no responses) can be deleted, and how the trigger allows exactly that case.
- Whether there's an archived state that hides a form from the list, separate from availability.
- How either choice shows up in the API, the builder, and ADRs 0002 and 0007.

ADR 0001 says nothing about deleting forms, so whatever this decides needs no amendment note there ([Accept the domain baseline and its amendments](./18-accept-the-domain-baseline-and-its-amendments.md)). It must still keep §5 rule 8 and the line saying disabling a form must not require deleting its versions or responses.

## Answer

Recorded as [ADR 0014](../../../docs/adr/0014-only-never-published-forms-can-be-deleted.md), with inline `(amended …)` notes on [ADR 0007](../../../docs/adr/0007-answer-rows-and-trigger-enforced-persistence-invariants.md) and [ADR 0010](../../../docs/adr/0010-respondent-api-split-and-host-owned-lookups.md). Despite this ticket's premise, [ADR 0002](../../../docs/adr/0002-mvp-product-calls.md) never says forms can't be deleted, so it's unchanged. ADR 0001 and `GLOSSARY.md` are unchanged too. "Amended by" notes were added to [Persistence model](./10-persistence-model.md) and [HTTP API surface](./16-http-api-surface.md). The spec is left for [Revise the phased plan and spec](./30-revise-the-phased-plan-and-spec.md) (see the last bullet below).

- **Published forms are permanent.** A form with any published version can never be deleted, even with zero responses. The `form_versions` triggers stay unconditional, and closing the form is the only way to retire it. Rejected: deleting published forms that have no responses (it needs a version-trigger exception, erases publication history, and breaks host embeds and anonymous grants that hold the form id).
- **Never-published forms can be hard-deleted.** They own rows only in `forms`, `drafts` and `form_external_refs`, because question identities, versions and question keys are written at publish. Rejected: soft deletion.
- **No archived state in the MVP.** Retired forms stay in `GET /forms` as closed forms. An archive flag is additive later (a column plus a list filter) and is now under the map's Out of scope.
- **Discarding the draft of a never-published form is refused** with 409 `FormNotPublished`. This closes a gap: discarding it used to leave a form with no draft and no version, which `FormSummary` couldn't title and nothing could remove. Now every form has a draft, a current version, or both. Rejected: discarding deletes the form (one endpoint doing two things), and allowing the empty form.
- **Persistence**:
  - The `forms` `BEFORE DELETE` row trigger rejects the delete only when `EXISTS (SELECT 1 FROM form_versions WHERE form_id = OLD.id)`. That checks the real invariant, not the `current_version_id` pointer. `TRUNCATE` on `forms` stays rejected.
  - `drafts.form_id` and `form_external_refs.form_id` get `ON DELETE CASCADE`.
  - The `form_versions` triggers and the `ON DELETE RESTRICT` from `responses` are unchanged, as the second safeguard.
  - The use case runs in one transaction under `FOR UPDATE` on the form row, the lock publish takes, so a delete and a publish happening at once are serialised.
- **API**: `DELETE /forms/{formId}?expectedRevision=…` needs `forms:manage` and returns 204.
  - `expectedRevision` is required (the draft always exists), so a stale admin can't delete another admin's newer edits.
  - The checks run in this order: 404 `NotFound` (including another tenant's form), then a new 409 `FormPublished` with no extra fields (the eighth state conflict), then 409 `RevisionConflict`. `FormPublished` comes first because once someone else has published, the draft is gone and "it's published now" is the useful answer.
- **Builder**: never-published forms show "Delete form" (with a confirmation step) in place of "Discard draft", and it returns the admin to the form list. Published forms show neither delete nor archive, only the availability toggle.
- **Tests**:
  1. Persistence, against both PGlite and `test:pg`: a raw SQL `DELETE` of a published form fails even as the table owner, `TRUNCATE` on `forms` fails, and deleting a never-published form removes its draft and references by cascade.
  2. Use case: deleting a published form gives `FormPublished`, a stale revision gives `RevisionConflict`, discarding a never-published form's draft gives `FormNotPublished`, and a delete racing a publish ends with either the form gone and no version, or the version published and `FormPublished`, never both.
  3. `http-api`: 403 without `forms:manage`, and 404 for another tenant's admin.
  4. Playwright, builder project: create a form, delete it, and check it's gone from the list.
- **For [Revise the phased plan and spec](./30-revise-the-phased-plan-and-spec.md)**:
  - Phase 1 gains the trigger change, the cascades, the delete use case and endpoint, and tests 1 to 3.
  - Phase 3 gains the builder action and test 4.
  - The seed section's reason changes from "forms can't be deleted" to "published forms can't be deleted". `seed:reset` still drops the schema, because the seed publishes its forms.
