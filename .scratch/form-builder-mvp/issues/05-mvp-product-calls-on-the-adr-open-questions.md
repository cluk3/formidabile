# MVP product calls on the ADR open questions

Type: grilling
Status: resolved
Map: [Form builder MVP](../map.md)

## Question

For each open question in ADR 0001 §13 that is still in scope, what is the minimal MVP answer that meets the §12 bar, or is it deferred? In particular:

- One active draft per form, or several concurrent drafts?
- Can respondents resume incomplete responses (autosave), and what happens to abandoned ones?
- Can respondents edit or resubmit after submission? Who configures duplicate-submission rules, and how?
- Can historical versions be reopened for new submissions?
- Which question types ship in the MVP (is file upload in or out), and is any conditional visibility in?
- The submission consistency policy (ADR §5): when a new version is published mid-session, accept under the presented version or require a reload?
- Do analytics combine compatible versions by default or only on request?
- Where do external references live: on forms, on responses, or in a separate association model?
- What retention and deletion behaviour does the MVP need, if any?
- Are analytics built inside the module, or exposed as data for hosts to consume?

## Answer

Recorded as [ADR 0002](../../../docs/adr/0002-mvp-product-calls.md). New glossary terms: question type, availability, preview, superseded version, response limit.

- **Drafts**: a form has at most one draft. It's created from the current published version, or starts empty for a new form. It can be saved, previewed, discarded or published. A save carries a revision number, and a save from a stale copy is rejected, not merged.
- **Incomplete responses**: not stored on the server. There's no autosave and no resume; answers in progress live only in the renderer, and an abandoned response leaves nothing behind. A response exists only once it's successfully submitted, so it has no status lifecycle.
- **Editing after submission**: allowed.
  - Only the respondent who submitted can edit, and only if the host identified them at submission. Anonymous responses can't be edited, and admins can't edit answers.
  - An edit validates against the response's original form version and keeps pointing at it, even after newer versions are published.
  - An edit overwrites the answers in place and records a last-edited time, with no history. Analytics reflect the latest answers.
  - A response can be edited while its form's availability is open and becomes read-only when the form is closed.
  - An edit carries a revision number, and an edit from a stale copy is rejected.
- **Response limit**: set per form. `unlimited` is the default and accepts identified and anonymous respondents. `one per respondent` accepts only identified respondents and rejects a second submission with `already_responded`, pointing at the existing response to edit.
- **Historical versions**: never reopened for new submissions.
- **Submission consistency (ADR §5)**: a submission must target the current published version. A submission against a superseded version is rejected with `version_superseded`, and the renderer reloads an empty form on the current version, with no answers carried over.
- **Question types**: short text, long text, email, number, date, single choice, multiple choice and boolean. Dropdown is a display setting on single choice (`radio` or `dropdown`), not a separate type. File upload and conditional visibility are out. Amended by [Canonical form definition model](./08-canonical-form-definition-model.md): short and long text merged into one text type with a single-line or multi-line display, so seven types.
- **External references**: forms have a many-to-many association set that the host adds and removes. It isn't part of the definition and isn't versioned. A response carries a list of external references supplied at submission, and an edit doesn't change it.
- **Availability**: a form is open or closed, separately from its publication history. A form can't be opened without a published version. A closed form rejects new submissions and edits.
- **Retention and deletion**: an authorized admin can hard-delete one response and its answers, or all responses for a given respondent id. There are no retention periods and no anonymisation. A form version is never deleted while any response references it, and forms are closed, never deleted.
- **Analytics**: built inside the module and served through its API and the builder: counts by version, choice distributions and numeric summaries. Questions that share a question identity and are compatible across versions are combined by default, with the per-version breakdown always visible. Incompatible questions are shown separately. There's no response export.
- **Preview**: the builder renders the draft with the real renderer and validates answers in the browser, but never calls the submission endpoint.
