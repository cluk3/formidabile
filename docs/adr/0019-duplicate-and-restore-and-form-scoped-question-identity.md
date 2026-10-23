# ADR-019: Duplicate and restore are compositions of existing endpoints, and question identity belongs to one form

- **Status:** Accepted
- **Date:** 2026-10-22

Editors need to start a form from an existing one, and to bring an old version back. Duplicate creates a new, never-published form whose draft is the definition of a chosen version or draft of another form in the caller's tenant. Restore replaces a form's draft with the definition of one of that form's own published versions. Neither needs a new endpoint: duplicate is `POST /forms` with the copied definition, and restore is `PUT /forms/{formId}/draft`, which already creates a draft when `expectedRevision` is `null`. Both need `forms:manage`, and any host can do what the builder does. A question identity is scoped to one form: `question_identities` is keyed by form and question, and every analytics query filters by form. So a duplicate keeps every id and shares no history with its source. This sharpens ADR-001 §4.4 and ADR-009, whose compatibility claim holds across the versions of one form. The research is in `.scratch/form-builder-iteration/research/form-reusability.md`.

The calls a reader is most likely to "fix" by mistake:

- **A duplicate keeps question ids, option values, row values and page ids.** Its conditions and jumps (ADR-017) therefore carry over unchanged. Two forms may hold the same question UUID, and that is not a claim that they ask the same question. Any future query across forms must group by form and identity together, never by identity alone.
- **A duplicate copies only the definition.** The form's external references, availability and response limit start at a new form's defaults, because they describe the source form's place in the host. The builder adds " (copy)" to the draft title, cut short to stay within its 200-character cap. The API stores whatever it is sent.
- **Restore never creates a version.** It replaces the single draft (ADR-002), and publishing that draft creates the next version, so no published version is rewritten (ADR-005). The builder asks before replacing a draft and saves with that draft's revision, so a save made in the meantime gives `RevisionConflict`. Restoring the current version is how an editor throws away their changes and keeps a draft open, which discarding the draft doesn't do.
- **A copied definition is stored as it was sent.** Every endpoint that takes a definition accepts every format a reader accepts, 1 and 2. A missing `format` or an unknown key gives 422. Only the builder upgrades a draft to format 2, when it saves.
- **The module stores no templates and calls no AI model.** A host keeps template definitions and posts them as new forms, in whichever tenant its token names, which is how a template crosses tenants. A host that generates definitions with a model posts the result the same way, and publish checks it like any draft.

## Considered options

- **Minting new ids on duplicate.** Rejected: identity is already scoped to one form, so new ids buy nothing, and every condition and jump would need rewriting.
- **Dedicated duplicate and restore endpoints.** Rejected: each operation is already a single atomic request on an existing endpoint, so a new endpoint would add contract without adding a guarantee.
- **Restore as a second draft, or straight to a new version.** Rejected: a form has one draft (ADR-002), and publishing a restored version directly would skip the draft and its preview.
- **Copying external references and settings.** Rejected: references are host-owned associations with the source form, and a copy would claim a link the host never made.
- **A template gallery in the module.** Rejected: it would be a second store of definitions. Hosted products keep galleries because they are the account system, and this module isn't.
- **AI generation in the module.** Rejected: the module would choose a model processor the host never deployed, and would send form content to it.
