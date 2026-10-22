# Form reusability: templates, copies, libraries and definition portability

Researched 2026-10-22 against Typeform Create API docs and Help Center articles as published that day; Tally Help Center and Developer Docs (OpenAPI `info.version` `1.0.0`, API version header example `tally-version: 2025-02-01`); Google Docs Editors Help and Google Forms API `forms.create` (page last updated 2025-04-08 UTC); Jotform Help articles dated on the pages (clone-in-account 2025-10-10, clone-from-URL 2026-07-28, templates 2026-09-01, AI import 2026-03-27) and the Jotform API overview; Fillout Help Center; Formbricks docs plus source on `main` and, for the copy implementation, commit [`a2bd102`](https://github.com/formbricks/formbricks/commit/a2bd102) (2026-10-21, the latest commit on `apps/web/modules/survey/list/lib/survey.ts` in the file history retrieved 2026-10-22; the 6.1 upgrade commit `565ec33` is earlier on the same file); SurveyJS Creator docs (the toolbox page matches [`survey-creator/docs/toolbox-customization.md`](https://github.com/surveyjs/survey-creator/blob/master/docs/toolbox-customization.md) on `master`; no release tag was pinned); Form.io documentation (no product version printed on the pages). Formidabile's current model is the repo as read the same day: definition `format: 1`.

Question types, conditional-logic rule shapes and validation constraints are covered by the sibling notes in this directory. This note only records how those pieces travel when a form is copied or imported.

Sources:

- **Typeform.** Help Center articles fetched as HTML and converted to text. The Create API reference was read at [Create form](https://www.typeform.com/developers/create/reference/create-form/). A Retrieve form URL exists; its response body was not re-read, so this note does not claim the GET payload matches the POST body field for field.
- **Tally.** Help articles and the [POST /forms](https://developers.tally.so/api-reference/endpoint/forms/post) OpenAPI page. No dedicated "duplicate this form" help article turned up in help-center search.
- **Google.** Docs Editors Help, the Forms API `forms.create` reference, and the Apps Script `Form` class reference. Community threads were not used as evidence.
- **Jotform.** Help articles, including their "Last Update" dates. The [API overview](https://api.jotform.com/docs/) was read; the properties reference index was not read line by line.
- **Fillout.** Help articles via the Mintlify markdown URLs linked from [llms.txt](https://www.fillout.com/help/llms.txt).
- **Formbricks.** Docs, plus these source files: [`survey.ts` `copySurveyToOtherWorkspace`](https://github.com/formbricks/formbricks/blob/a2bd102/apps/web/modules/survey/list/lib/survey.ts#L230-L621), [`survey-dropdown-menu.tsx`](https://github.com/formbricks/formbricks/blob/a2bd102/apps/web/modules/survey/list/components/survey-dropdown-menu.tsx#L210-L331), [`copy-survey-modal.tsx`](https://github.com/formbricks/formbricks/blob/a2bd102/apps/web/modules/survey/list/components/copy-survey-modal.tsx), [`v3-template-client.ts`](https://github.com/formbricks/formbricks/blob/main/apps/web/modules/survey/components/template-list/lib/v3-template-client.ts), [`template.tsx`](https://github.com/formbricks/formbricks/blob/main/apps/web/modules/survey/components/template-list/components/template.tsx), [`ai-create-utils.ts`](https://github.com/formbricks/formbricks/blob/main/apps/web/modules/survey/components/template-list/lib/ai-create-utils.ts) and the review flow in [`create-with-ai-form.tsx`](https://github.com/formbricks/formbricks/blob/main/apps/web/modules/survey/components/template-list/components/create-with-ai-form.tsx). The `main` copies of the template and AI files were not pinned to a SHA (the contents API rate-limited before that call). A draft PR that would have added in-app survey JSON import/export, [#6869](https://github.com/formbricks/formbricks/pull/6869), was closed unmerged.
- **SurveyJS.** Creator documentation. The `clone` / `toJSON` / `fromJSON` method names are listed on the [Survey Element](https://surveyjs.io/form-library/documentation/api-reference/SurveyElement) reference; the `clone` implementation was not read.
- **Form.io.** Help pages for form JSON, revisions, resources, nested forms, and project migration. Application source for a "duplicate form" action was not read.
- **Formidabile.** [ADR-002](../../../docs/adr/0002-mvp-product-calls.md), [ADR-005](../../../docs/adr/0005-form-definition-model.md), [ADR-009](../../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md), [ADR-014](../../../docs/adr/0014-only-never-published-forms-can-be-deleted.md), and `packages/core/lib/definition/form-definition.ts` / `question-type.ts`.

## Summary

Reuse splits into three different objects that the products often blur together:

1. A **template** is a starting point. Using one creates another form. The original stays put.
2. A **duplicate / clone / copy** is also a new form, but taken from one the account already has. Products disagree about whether responses, integrations, themes and identifiers come along.
3. A **revision** is an older snapshot of the *same* form. Where it exists (Form.io, Fillout's edit history), restoring it does not create a second form.

Portable JSON exists as a first-class definition for SurveyJS, Form.io, Typeform's Create API and Tally's block API. Google Forms and Jotform expose APIs, but Google's create call refuses everything except the title, and Jotform's published v1 overview describes itself as mostly read-only. File import elsewhere is often an AI reconstruction (questions in, logic left behind), not a schema load.

AI generation, where documented, produces an editable draft the author then publishes. It is plan-gated or enterprise-gated for Typeform's higher modes, Google Gemini and Formbricks. Tally and Fillout document it as available on the free plan.

## 1. Summary table

"Not documented" means the official pages and source read for this note do not describe the mechanism. It is not a claim that the product lacks it. Plan gates are in the cell.

| Mechanism | Typeform | Tally | Google Forms | Jotform | Fillout | Formbricks | SurveyJS | Form.io |
|---|---|---|---|---|---|---|---|---|
| Built-in template gallery | Yes. [Use a template](https://help.typeform.com/hc/en-us/articles/360029294412-Use-a-template) | Yes. [Form templates](https://tally.so/help/form-templates) | Yes, Google-made. [Use templates](https://support.google.com/docs/answer/148833?hl=en) | Yes. Using one counts toward the form limit. [How to Use Form Templates](https://www.jotform.com/help/106-how-to-use-form-templates) (2026-09-01) | Yes, "hundreds". [Form templates](https://www.fillout.com/help/form-templates) | Yes. UI cards call `createSurvey`; the client posts `source: "catalog"`. [template.tsx](https://github.com/formbricks/formbricks/blob/main/apps/web/modules/survey/components/template-list/components/template.tsx), [v3-template-client.ts](https://github.com/formbricks/formbricks/blob/main/apps/web/modules/survey/components/template-list/lib/v3-template-client.ts) | No hosted gallery in the library docs. Doc examples and toolbox presets only. [Toolbox](https://surveyjs.io/survey-creator/documentation/toolbox-customization) | No public gallery in the pages read. A project template is your own export. [Migrating Projects](https://help.form.io/deploy/maintenance-and-migration) |
| Save as template | Not documented on the template article | Yes, after publish: Share → Create a template. [Form templates](https://tally.so/help/form-templates) | Not documented on the template article | Not documented on the templates article | Yes: Share → Template. [Create your own form template](https://www.fillout.com/help/make-a-form-template) | Client accepts `source: "custom"`. The save UI was not read. [v3-template-client.ts](https://github.com/formbricks/formbricks/blob/main/apps/web/modules/survey/components/template-list/lib/v3-template-client.ts) | The host adds a toolbox JSON variation. That config is not a stored template record. [Toolbox](https://surveyjs.io/survey-creator/documentation/toolbox-customization) | Export a project template, whole or a chosen set of forms and resources. [Migrating Projects](https://help.form.io/deploy/maintenance-and-migration) |
| Org / workspace-shared templates | Forms move or copy between workspaces. Org owners can copy across organizations. Not a template library. All plans for the copy/move feature. [Copy or move](https://help.typeform.com/hc/en-us/articles/360047720791-Copy-or-move-forms-between-accounts-and-Workspaces) | Private template: only people with access to that form's workspace. Extra workspaces are **Tally Pro**. [Form templates](https://tally.so/help/form-templates), [Workspaces](https://tally.so/help/workspaces) | Make a copy lets you pick where the file is saved. Domain template gallery: not documented on the official template page | Clone-from-URL reaches another account if cloning is allowed. Team workspace articles exist; they were not read as a template-sharing spec. [Clone from a URL](https://www.jotform.com/help/42-how-to-clone-an-existing-form-from-a-url) (2026-07-28) | Intended ("inside or outside of your organization"), but the same page says templates should be set to Public for now. Classic workspaces hold forms; on Free only org admins can create them. [Create your own template](https://www.fillout.com/help/make-a-form-template), [Workspaces](https://www.fillout.com/help/workspaces) | Duplicate stays in the workspace. Copy targets other writable workspaces in the organization. [dropdown](https://github.com/formbricks/formbricks/blob/a2bd102/apps/web/modules/survey/list/components/survey-dropdown-menu.tsx#L210-L375), [modal](https://github.com/formbricks/formbricks/blob/a2bd102/apps/web/modules/survey/list/components/copy-survey-modal.tsx) | Host-defined | A project is the boundary. Importing a template clones forms, resources, roles and actions into the destination project. [Migrating Projects](https://help.form.io/deploy/maintenance-and-migration) |
| Duplicate form | Yes. Name plus " (copy)". Greyed out on Free at the form cap. [Duplicate](https://help.typeform.com/hc/en-us/articles/360029295012-How-to-duplicate-a-form) | Not documented as a UI control. The help API shows creating a new form from a fetched block list. [API](https://tally.so/help/api) | Yes. File → Make a copy, and it names Forms. [Use templates](https://support.google.com/docs/answer/148833?hl=en) | Yes, Clone. Counts toward the form limit. [Clone in account](https://www.jotform.com/help/27-how-to-clone-an-existing-form-from-your-account) (2025-10-10) | Yes. "Two identical forms, with different unique links." [Duplicate a form](https://www.fillout.com/help/duplicate-a-form) | Yes. Menu → Duplicate calls the copy action with the current workspace id. Archived surveys hide it. [dropdown L210–231, L318–331](https://github.com/formbricks/formbricks/blob/a2bd102/apps/web/modules/survey/list/components/survey-dropdown-menu.tsx#L210-L331) | `clone` is a method on survey elements. A second survey is a second JSON document. [Survey Element](https://surveyjs.io/form-library/documentation/api-reference/SurveyElement) | Not documented as a form-level duplicate. The documented copies are template import and revision restore (same form). |
| Copy questions or pages between forms | Pasted text, via AI or the importer, appended at the end of an existing form. Importer box max 6,000 characters. Not a structural field copy. [Import questions](https://help.typeform.com/hc/en-us/articles/19585703741332-Import-questions-into-Typeform-from-another-tool) | Not documented in the pages read | Yes: Import questions, picking questions from another form. Also Duplicate question / image / section *inside* the open form. [Edit your form](https://support.google.com/docs/answer/2839737?hl=en) | Not documented. The templates article's comments ask about merging questions; that is not a help statement | Yes. Copy/paste "on different pages of your form or even on entirely different forms." [Copy and paste](https://www.fillout.com/help/copy-paste-fields). Same-page duplicate is separate. [Duplicate questions](https://www.fillout.com/help/duplicate-fields) | Not in the files read | Copy a JSON fragment, or `clone` an element. No multi-survey library in the docs read | Nested Form embeds a child form by id instead of copying its components. [Nested forms](https://help.form.io/form-building/nested-forms) |
| Reusable block / question library | Not documented. Question groups are a question type inside one form, not a library | Not documented. A template is a whole form | Other forms, via Import questions. No separate block library in the help read | Widgets travel with a clone (third-party accounts disconnected). That is a field-type catalog, not a saved bank of your questions. [Clone in account](https://www.jotform.com/help/27-how-to-clone-an-existing-form-from-your-account) | No separate library in the pages read. Copy/paste is the reuse tool | Whole-survey templates (`catalog`, `custom`, `xm`) | Toolbox JSON variations and subitems: reusable *configurations* of built-in types. [Toolbox](https://surveyjs.io/survey-creator/documentation/toolbox-customization) | Resources, "Existing Resource Fields", and the Nested Form (`type: "form"`). [Resources](https://help.form.io/form-building/resources-readme), [Nested forms](https://help.form.io/form-building/nested-forms) |
| JSON export | The Create API document is the definition. No file-download export was documented in the help articles read. [Create form](https://www.typeform.com/developers/create/reference/create-form/) | `GET /forms/{formId}` returns the blocks the help page says to copy. No "download JSON" help article found. [API](https://tally.so/help/api) | The [Form resource](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms) is the JSON document. `forms.create` is the method read; a file export is not in the help articles read. Whether `forms.get` returns that full document was not re-read | API v1 overview says you can get form information and "download existing form data", and that v1 is mostly read-only. It does not show a form-definition download. [API](https://api.jotform.com/docs/) | Yes: dashboard → Export form downloads a file. Format name not stated. Submissions and comments excluded. [Import, export, and migrate](https://www.fillout.com/help/importing-and-exporting-forms) | `GET /api/v3/surveys/{id}` returns the survey document. [Migrating surveys](https://formbricks.com/docs/self-hosting/advanced/migrating-surveys). In-app file export: not in current docs; draft PR #6869 was closed unmerged | `toJSON` is the definition. [Survey Element](https://surveyjs.io/form-library/documentation/api-reference/SurveyElement) | The builder's Form JSON, and Export Template for a project. [Form JSON](https://help.form.io/form-building/form-json), [Migrating Projects](https://help.form.io/deploy/maintenance-and-migration) |
| JSON import | `POST` the Create form body. Images must already exist in the account. [Create form](https://www.typeform.com/developers/create/reference/create-form/) | `POST /forms` with `blocks` (max 65,536) and `status`. Also file import of a `.json`. [POST /forms](https://developers.tally.so/api-reference/endpoint/forms/post), [Import](https://tally.so/help/import) | Not a file import. `forms.create` copies only `info.title` and `info.document_title`; items are a later update. [forms.create](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms/create) | Not documented on the API overview | Import an exported Fillout form. Structure only; submissions omitted. [Import, export, and migrate](https://www.fillout.com/help/importing-and-exporting-forms) | `POST /api/v3/surveys` accepts a survey document and **keeps** block, element and ending ids. Unknown keys are rejected. [Migrating surveys](https://formbricks.com/docs/self-hosting/advanced/migrating-surveys) | `fromJSON`. [Survey Element](https://surveyjs.io/form-library/documentation/api-reference/SurveyElement) | Import Project Template (new project or into an existing one). [Migrating Projects](https://help.form.io/deploy/maintenance-and-migration) |
| Import from a file, CSV, or another tool | Pasted questions, or AI file upload (pdf, doc, csv, xls, ppt, txt, md, html, xml, json, yaml). [Import questions](https://help.typeform.com/hc/en-us/articles/19585703741332-Import-questions-into-Typeform-from-another-tool), [Typeform AI](https://help.typeform.com/hc/en-us/articles/42053773420948-Use-Typeform-AI) | Typeform OAuth keeps questions, logic and structure. Files: PDF, image, JSON, CSV, Markdown, Word. Excel by saving as CSV. File import does **not** extract logic or calculations. Free. [Import](https://tally.so/help/import) | Another Google Form's questions only, in the help read. Gemini can also take Docs, Sheets, Slides and PDFs. [Edit your form](https://support.google.com/docs/answer/2839737?hl=en), [Gemini](https://support.google.com/docs/answer/16346789?hl=en) | AI import of a **public** form URL or form name, cloning allowed. [AI import](https://www.jotform.com/help/how-to-import-forms-with-jotform-ai/) (2026-03-27). CSV import in the API use-case list is **submissions**, not the form. [API](https://api.jotform.com/docs/) | Typeform, Jotform, SurveyMonkey, Google Forms (labels, options, workflows, email notifications including recipients; "backend settings" excluded). PDF. Pasted questions. [Import, export](https://www.fillout.com/help/importing-and-exporting-forms), [AI forms](https://www.fillout.com/help/ai-forms) | Qualtrics `.qsf` → a draft survey, under Enterprise AI. [AI features](https://formbricks.com/docs/platform/features/ai-features). Instance-to-instance copy is the management API, not a file | Host's responsibility. Not a product importer in the docs read | Project template JSON. Submissions are a separate CLI migration. [Migrating Projects](https://help.form.io/deploy/maintenance-and-migration) |
| Clone from a specific version / revision | Not documented | Not documented | Not documented | Not documented | Restore an edit-history snapshot of the **same** form. [Restore previous version](https://www.fillout.com/help/restore-previous-version) | Not a revision picker. Duplicate copies the survey as it is now and forces `status: "draft"`. [survey.ts L320–326](https://github.com/formbricks/formbricks/blob/a2bd102/apps/web/modules/survey/list/lib/survey.ts#L320-L326) | No server revisions in the library | Restore clones that revision into a **new vid of the same form**. It does not overwrite the old vid. **Security Module**; on for Trial projects at portal.form.io. [Form Revisions](https://help.form.io/form-building/form-revisions) |
| Public template / share link | Gallery templates are public to browse; Use this template picks a workspace. No "share my form as a template link" article read | Public: anyone with the link can use it. Private: workspace only. Listing in Tally's gallery is a separate submission. [Form templates](https://tally.so/help/form-templates) | The gallery opens a copy. Sharing a form so others can copy it is ordinary Drive sharing; a template-link mode was not documented | Clone from the form URL unless the form is private, password-protected, or Prevent Cloning is on. [Clone from a URL](https://www.jotform.com/help/42-how-to-clone-an-existing-form-from-a-url) | Public templates get a landing page. Support can list one in the gallery. [Create your own template](https://www.fillout.com/help/make-a-form-template) | Not in the files read | n/a | n/a in the pages read |
| API / programmatic creation from a definition | `POST` Create form. 201, `Location` header. [Create form](https://www.typeform.com/developers/create/reference/create-form/) | `POST /forms` with `templateId` and/or `blocks`. `blocks` and `status` required. Free, 100 requests/minute, date-pinned by `tally-version`. [POST /forms](https://developers.tally.so/api-reference/endpoint/forms/post), [API](https://tally.so/help/api) | `POST https://forms.googleapis.com/v1/forms` then an update for items. [forms.create](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms/create) | Not documented. Overview: "Version 1 is mostly read only." Daily caps by plan (1,000 starter … unlimited Enterprise). [API](https://api.jotform.com/docs/) | The help index lists get-forms, metadata, submissions and webhooks. No create-form endpoint is listed. [llms.txt](https://www.fillout.com/help/llms.txt) | `POST /api/v3/surveys` and `POST /api/v3/surveys/templates` (`templateId`, `source`, `surveyType`, `defaultLanguage`). [Create survey](https://formbricks.com/docs/api-reference/management-api--survey/create-survey), [v3-template-client.ts](https://github.com/formbricks/formbricks/blob/main/apps/web/modules/survey/components/template-list/lib/v3-template-client.ts) | In-process `fromJSON` / Creator. No HTTP API | Forms are the REST resource the JSON "generates". The portal also uploads a project template. Exact `POST /form` body was not re-read. [Form JSON](https://help.form.io/form-building/form-json) |
| AI as a way to start | Yes. Prompt, pasted questions, voice, URL/company lookup, or files. Applied to a draft; a live form stays live until Publish edits. [Typeform AI](https://help.typeform.com/hc/en-us/articles/42053773420948-Use-Typeform-AI) | Yes. Prompt, or a screenshot/PDF in chat; "logic, structure, and branding included." Documented as free. [Import](https://tally.so/help/import) | Yes, Gemini "Help me create a form", then Create form / Create quiz. Needs a Workspace or Google AI plan, or Workspace Experiments. [Gemini](https://support.google.com/docs/answer/16346789?hl=en) | The article read is import-by-prompt (URL or form name), then edit in the chat or Form Builder. A separate from-scratch generator article was not read. [AI import](https://www.jotform.com/help/how-to-import-forms-with-jotform-ai/) | Yes. Prompt, pasted questions, another tool's URL, or a PDF. The article calls the builder free. Then you publish. [AI forms](https://www.fillout.com/help/ai-forms). A [Turn off AI](https://www.fillout.com/help/disable-ai) page is listed in the help index; its body was not read | Yes, **Enterprise**. Prompt of 4–1,200 characters, review a draft, then Open in editor. Off until the org enables Smart functionality. [ai-create-utils.ts](https://github.com/formbricks/formbricks/blob/main/apps/web/modules/survey/components/template-list/lib/ai-create-utils.ts), [AI features](https://formbricks.com/docs/platform/features/ai-features) | Not documented in the pages read | Not documented in the pages read |

## 2. What a template or duplicate actually copies

### Typeform

**Duplicate** (same account): the copy appears in the workspace, named `{original} (copy)`. Not copied: follow-up message setup, multi-language translation files, meta information, and collected results. Free accounts cannot duplicate once they are at the included form cap; the control is greyed out. ([Duplicate](https://help.typeform.com/hc/en-us/articles/360029295012-How-to-duplicate-a-form))

**Copy to a workspace** (same account or, for an organization owner, another organization): "Only the form's structure" is transferred. Not copied: results, follow-up messages, custom system messages, and meta information. The latest changes have to be published first. A workspace owner who is not an organization owner can move forms between workspaces in the same account only. ([Copy or move](https://help.typeform.com/hc/en-us/articles/360047720791-Copy-or-move-forms-between-accounts-and-Workspaces))

**Move** is not a copy. Responses move with the form. Moving to another account changes the form URL; respondents see a redirect. ([Copy or move](https://help.typeform.com/hc/en-us/articles/360047720791-Copy-or-move-forms-between-accounts-and-Workspaces))

The Create API settings say the signature-block BCC list (`email_consent_notifications_config.recipient_emails`) "is cleared when a form is copied or duplicated". ([Create form](https://www.typeform.com/developers/create/reference/create-form/))

**Template:** Use this template creates an editable form in a workspace you pick and opens the Content panel. "The template theme will also be added to My themes" for that form. Editing the copy does not change the gallery template. ([Use a template](https://help.typeform.com/hc/en-us/articles/360029294412-Use-a-template))

**Identifiers.** Logic jumps address a field's `ref`, a "readable name you can use to reference the field", not the system id. Choice `ref`s are the same kind of name. The create example also shows an `id` on fields nested in a group or matrix. The help articles do not say whether a UI duplicate mints new ids or keeps `ref`s. If a caller re-posts a definition, they choose the `ref`s, and logic that points at those `ref`s keeps working only if the `ref`s are unchanged. ([Create form](https://www.typeform.com/developers/create/reference/create-form/))

What the duplicate articles do **not** say: whether logic, theme, integrations, hidden fields or variables are in "the structure".

### Tally

**Template:** Use this template opens it in the editor. Changes apply only to that form. A template you create comes from a **published** form (Share → Create a template), with a name and Public or Private. Both show under "By my team". Public means anyone with the link; Private means people who can access that form's workspace. ([Form templates](https://tally.so/help/form-templates))

**API create from a template or from blocks.** `POST /forms` takes `workspaceId` (default workspace if omitted), `templateId`, `folderId`, `status` (`BLANK` | `DRAFT` | `PUBLISHED`) and `blocks`. `blocks` and `status` are required. The help page's "duplicate and personalize" example is: GET the form, then POST a new one whose `blocks` were copied, with the caller supplying block `uuid`s. There is no `name` field; the form name is the first block, which must be `FORM_TITLE`, via `payload.title`. ([POST /forms](https://developers.tally.so/api-reference/endpoint/forms/post), [API](https://tally.so/help/api))

Block `uuid` and `groupUuid` are caller-supplied UUID strings. Logic actions refer to block UUIDs (`showBlocks`, `hideBlocks`, `requireAnswer`) and conditions refer to a `Field` by `uuid`. The docs do not say the server rewrites those ids. A copied block list keeps its internal references only if the UUIDs in the POST are the ones the logic already uses. Whether the API rejects a UUID that already exists on another form was not stated.

**File import** "generates the form's questions" as an editable draft. "Conditional logic and calculations aren't extracted automatically." Typeform OAuth import is the exception: "questions, logic, and structure included." ([Import](https://tally.so/help/import))

**Workspaces.** Moving a form between workspaces is Move, not a copy. Creating workspaces is Pro. Folder membership follows the workspace; folders have no separate ACL. ([Workspaces](https://tally.so/help/workspaces))

### Google Forms

**Make a copy** is File → Make a copy: you name it and choose where it is saved. The same article says a template from the gallery "opens" as "a copy of the template". Optional comment copying is described in that section; it does not say whether form responses are copied. ([Use templates](https://support.google.com/docs/answer/148833?hl=en))

**Import questions** copies selected questions from another form into the open form. It does not say that sections, responses, or the source form's settings come along. **Duplicate** of a question, image, or section stays inside the open form. ([Edit your form](https://support.google.com/docs/answer/2839737?hl=en))

**API.** `forms.create` states: "Only the `form.info.title` and `form.info.document_title` fields are copied to the new form. All other fields including the form description, items and settings are disallowed." Items are added by a later update. `unpublished=true` creates a form that does not accept responses. ([forms.create](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms/create))

Apps Script `Form.getId()` is the form id; `Item` ids are read with `getId()` / `getItemById`. The reference does not document a `Form.copy()` or what happens to item ids when a Drive file is copied. ([Class Form](https://developers.google.com/apps-script/reference/forms/form))

### Jotform

Two clones, with different lists. Both count toward the form limit, both are independent of the original, both are named `Clone of {original}`, and neither copies submissions.

**Clone inside the account** ([article](https://www.jotform.com/help/27-how-to-clone-an-existing-form-from-your-account), 2025-10-10), and the same article's note for "when you clone a form from another account":

Copied: logo, basic fields, payment fields, widgets, pages, sections, colours, style, theme, layout. Settings including conditionally enabled status, warnings, languages, password protection, auto-delete submissions, save and continue, unique submission, unique field, accessibility, page title, clear hidden field values, highlight, layout, error navigation, Prevent Cloning, browser autocomplete. Notification and autoresponder emails **with** subject, content and recipients. Conditions, thank-you page, Jotform Sign automation, workflows, fillable PDFs, PDF documents.

Not copied: integrations, prefills, reports, submissions. Encryption is turned off. Widget third-party accounts are disconnected. Payment gateways stay connected.

**Clone from a URL** ([article](https://www.jotform.com/help/42-how-to-clone-an-existing-form-from-a-url), 2026-07-28) copies the same structural list and most of the same settings, but **not** password protection or Prevent Cloning (those forms cannot be cloned this way). Emails are copied but subject, content, recipients and other email settings **reset to default**. Conditions, thank-you page and Sign automation are copied. Workflows, PDFs, fillable PDFs, integrations, prefills and reports are not. Widget accounts **and** payment gateways are disconnected. The owner can also block all clones with "Do Not Allow My Forms to Be Cloned by Other Users".

Neither article says whether field ids are regenerated. The cloned form is a new form (it counts as one, and edits do not affect the original), so it has its own URL; the articles don't describe the URL scheme.

**Template:** Use Template "will create the forms included in it", and those count toward the limit. ([How to Use Form Templates](https://www.jotform.com/help/106-how-to-use-form-templates))

**AI import** saves "a copy in your Jotform account with a new name", then you edit it in the chat preview or open Form Builder. The source must be Public with cloning on. ([AI import](https://www.jotform.com/help/how-to-import-forms-with-jotform-ai/))

### Fillout

**Duplicate:** "two identical forms, with different unique links." You can rename. The article does not list logic, theme, integrations, responses or ids. ([Duplicate a form](https://www.fillout.com/help/duplicate-a-form))

**Questions:** the duplicate icon copies a field onto the same page. Copy/paste works "on entirely different forms". Moving fields (a different control) "will delete any answers already collected." A duplicated question connected to Airtable or Notion arrives "Not connected". ([Duplicate questions](https://www.fillout.com/help/duplicate-fields), [Copy and paste](https://www.fillout.com/help/copy-paste-fields))

**Export / import of a Fillout form:** the file includes "the form structure, such as questions and fields", not submissions. Integrations to Airtable, Notion and others must be reconnected; field mappings do not have to be set again. Export "does not include submissions and comments". Moving between workspaces is drag-and-drop, not a copy. ([Import, export, and migrate](https://www.fillout.com/help/importing-and-exporting-forms))

**Third-party import** brings "labels, multiple-choice options, workflows and email notification settings including recipients". "Other items, like backend settings, aren't included." Typeform multi-answer questions become Checkboxes. ([Import, export, and migrate](https://www.fillout.com/help/importing-and-exporting-forms))

**Template:** Use template "creates a copy of that template as a form". Share as template requires the fields on the Share → Template panel. "All templates should be set to Public for now." Public templates get a landing page. ([Form templates](https://www.fillout.com/help/form-templates), [Create your own template](https://www.fillout.com/help/make-a-form-template))

**Restore** puts an older edit back on the same form. It is not described as a new form. ([Restore previous version](https://www.fillout.com/help/restore-previous-version))

### Formbricks

Duplicate and "copy to other workspaces" are the same function, `copySurveyToOtherWorkspace`. Duplicate passes the current workspace id; the modal only offers *other* writable workspaces. ([dropdown L210–218](https://github.com/formbricks/formbricks/blob/a2bd102/apps/web/modules/survey/list/components/survey-dropdown-menu.tsx#L210-L218), [survey.ts L230–329](https://github.com/formbricks/formbricks/blob/a2bd102/apps/web/modules/survey/list/lib/survey.ts#L230-L329))

What the function writes:

- **New survey id** (`createId()`). Name plus the translated "copy" suffix. **`status: "draft"` always.**
- **Blocks, endings and the welcome card are `structuredClone`d.** Nothing in this function remaps block or element ids. Logic that points at those ids still points at them.
- Responses are not copied. This function creates a survey row only.
- Same workspace: triggers reconnect the existing action classes. Other workspace: match a code action by key, or a no-code action by `noCodeConfig`, otherwise create one; a name clash is suffixed.
- A private segment is recreated. A public segment in the **same** workspace is **connected** (shared with the source). In another workspace it is recreated, with a timestamp suffix if the title is taken.
- Follow-ups are copied without their ids. Quotas are copied only when quotas are enabled for the organization, including `endingCardId` (so those ids have to still match the cloned endings).
- Custom CSS is re-checked against the **destination** plan and may be dropped, with a notice, while the copy still succeeds. Across workspaces, `customHeadScriptsMode: "replace"` is forced to `"add"` so the copy does not turn off the target workspace's own head scripts.
- The copier becomes creator and owner. Visibility is the visibility a new survey would get in the target organization, not the source's. The source is only read.
- The copy counts against the target workspace's survey cap.

**Cross-instance migration** is a different operation and **does** copy responses. It keeps block, element and ending ids "verbatim" because `data` is keyed by element id and `endingId` names an ending. It assigns a new survey id and new response ids. It drops styling, follow-up emails, quotas, single-use settings, PIN, reCAPTCHA, custom head scripts, custom slug and targeting. Choice answers are stored as the **label**, and the target re-validates them, so a renamed choice rejects the old responses. ([Migrating surveys](https://formbricks.com/docs/self-hosting/advanced/migrating-surveys))

**Templates.** `POST /api/v3/surveys/templates` with `templateId` and `source` of `catalog`, `custom` or `xm`, plus `surveyType` and `defaultLanguage`. The card button is "use this template". Placeholder substitution runs before create (`replacePresetPlaceholders`). What the catalog JSON contains, and whether element ids in a template are stable across uses, was not read. ([v3-template-client.ts](https://github.com/formbricks/formbricks/blob/main/apps/web/modules/survey/components/template-list/lib/v3-template-client.ts), [template.tsx](https://github.com/formbricks/formbricks/blob/main/apps/web/modules/survey/components/template-list/components/template.tsx))

### SurveyJS

The definition **is** the JSON. A toolbox item's `json` is the object inserted when the author drops it on the design surface. A "CSAT" item is a rating question with preset title, rate type and bounds; the author can still change those properties. Subitems are the same idea nested under a built-in item (for example long text limited to 280 characters). ([Toolbox](https://surveyjs.io/survey-creator/documentation/toolbox-customization))

```js
creator.toolbox.addItem({
  name: "csat",
  title: "CSAT",
  json: {
    type: "rating",
    title: "Overall, how satisfied are you with our product?",
    rateType: "smileys",
    minRateDescription: "Dissatisfied",
    maxRateDescription: "Satisfied",
    minRate: 1,
    maxRate: 5
  }
});
```

The question `name` inside that JSON is the author's key. The docs read here do not describe a server minting new names on drop, and they do not describe a schema-version field on the survey JSON. `toJSON` / `fromJSON` / `clone` are the portability and copy methods listed on the element reference; their source was not read, so this note does not claim how `clone` treats `name`.

### Form.io

**Form JSON** is "the schema automatically created by the Form Builder". It renders the form, generates the REST API, and is hosted at the embed URL. Component `key` is the submission-data key (`firstName`, `emailAddress` in the published example). ([Form JSON](https://help.form.io/form-building/form-json))

```json
{
  "title": "Race Registration",
  "name": "raceRegistration",
  "path": "raceregistration",
  "type": "form",
  "display": "form",
  "components": [
    {
      "label": "First Name",
      "validate": { "required": true },
      "key": "firstName",
      "type": "textfield",
      "input": true
    }
  ]
}
```

The published example on that page includes a trailing extra `},` before the final brace. The object shape above is the part the page is illustrating; the page's literal example does not parse as JSON.

**Nested form** does not copy components into the parent. The parent stores `"type": "form"` and `"form": "<child form id>"`. Saving the child changes every parent that nests it, unless the Security Module is on and the parent pins a child revision. "Save as reference" also writes a submission on the child, and later edits sync both submissions. Maximum nesting depth is 5. ([Nested forms](https://help.form.io/form-building/nested-forms))

**Resources** are forms used as data objects. The same page says they can "house pre-defined fields called Existing Resource Fields"; it does not specify how a field is snapped out of the resource onto another form. ([Resources](https://help.form.io/form-building/resources-readme))

**Project template** export is a JSON file of forms, resources, roles and actions (not submissions, not project settings). You can export a subset. Import creates a project or updates one. Submissions move with `formio migrate` (CLI). Settings move with a separate GET/PUT. ([Migrating Projects](https://help.form.io/deploy/maintenance-and-migration))

The migration page also says reverse compatibility of "the Form JSON schema that is used to render forms" is the highest priority, and that a separate **database** schema version (example `3.3.9` in `db.schema`) is what upgrades migrate. That number is not a version field inside a form document.

## 3. Portability formats

| Product | Document | Versioning of the format | Create-from-definition |
|---|---|---|---|
| Typeform | Create-form JSON: `title`, `type`, `settings`, `theme`, `workspace`, `hidden`, `variables`, `welcome_screens`, `thankyou_screens`, `fields`, `logic`. Logic addresses `ref`s. | No schema-version field in the reference read. | `POST` Create form. 201 + `Location`. Images must already be in the account (`IMAGE_NOT_FOUND` otherwise). "It is not possible to inject third-party content." ([Create form](https://www.typeform.com/developers/create/reference/create-form/)) |
| Tally | Block array. Each block is `{ uuid, type, groupUuid, groupType, payload }`. Logic is a `CONDITIONAL_LOGIC` block whose actions point at block UUIDs. | API is date-pinned: `tally-version: 2025-02-01`. OpenAPI `info.version` is `1.0.0`. The block schema itself has no version field. | `POST /forms`. `status` `DRAFT` or blank creates a draft; `PUBLISHED` publishes. ([POST /forms](https://developers.tally.so/api-reference/endpoint/forms/post)) |
| Google | REST `Form`. Create accepts a `Form` but ignores everything except the two title fields. | The page is the v1 reference, last updated 2025-04-08. No form-schema version field described on `forms.create`. | `POST /v1/forms`, then `forms.update` / `batchUpdate` for items. ([forms.create](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms/create)) |
| Jotform | A properties reference exists (`api.jotform.com/docs/properties`). The overview does not present a versioned form schema. | "What is covered in Version 1?" — mostly read-only. | Not documented on the overview. ([API](https://api.jotform.com/docs/)) |
| Fillout | An exported form file. The article never says JSON or gives a schema. `GET` form metadata "returns all the questions in that form and other metadata". | Not stated. | No create-form method in the published help index. ([llms.txt](https://www.fillout.com/help/llms.txt), [Import, export](https://www.fillout.com/help/importing-and-exporting-forms)) |
| Formbricks | Survey document. v3 create example still shows a `questions` array; the 200 example also returns `blocks` with element `id`s. The migration guide's accepted keys are `workspaceId`, `name`, `type`, `status`, `metadata`, `defaultLanguage`, `languages`, `welcomeCard`, `blocks`, `endings`, `hiddenFields`, `variables`, `distribution`, `targeting`. | The migration page describes v1, v2 and v3 endpoints side by side. The create reference is labelled v1 and its example response already includes `blocks`. No single schema-version integer. | `POST /api/v3/surveys`. Unknown keys → 400 `invalid_params`. At least one block required. Element ids may be supplied and are kept. ([Migrating surveys](https://formbricks.com/docs/self-hosting/advanced/migrating-surveys), [Create survey](https://formbricks.com/docs/api-reference/management-api--survey/create-survey)) |
| SurveyJS | Survey JSON produced by Creator and consumed by `fromJSON`. | No version field documented on the toolbox page or the element method list. Compatibility is whichever library version interprets the JSON. | In-process only, in the docs read. |
| Form.io | Form JSON (`title`, `name`, `path`, `type`, `display`, `components[]` with `key` and `type`). Project template JSON is a different, larger file. | Form JSON changes are described as reverse-compatible. The numbered schema (`db.schema.version`) is the server database, not the form file. | Portal template upload, and the REST API the form JSON generates. The request path was not copied out of a reference page in this pass. |

Tally block excerpt (the required identity fields; payloads vary by `type`):

```yaml
BlockUuid:
  type: string
  format: uuid
GroupUuid:
  type: string
  format: uuid
  description: >-
    Groups related blocks together. For child blocks (dropdown options,
    multiple choice options), use the parent block's uuid.
```

Formbricks create-survey excerpt (ids are part of the body the API accepts):

```json
{
  "workspaceId": "{{workspaceId}}",
  "name": "Example Survey",
  "type": "link",
  "status": "inProgress",
  "questions": [
    {
      "id": "ovpy6va1hab7fl12n913zua0",
      "type": "openText",
      "headline": { "default": "What would you like to know?" },
      "required": true
    }
  ]
}
```

The v3 migration guide is stricter than that v1 example: a read-back document must have `id`, `workspaceId`, `createdAt`, `updatedAt` and `archivedAt` removed before POST, and element ids inside blocks are the ones you **leave in**. ([Migrating surveys](https://formbricks.com/docs/self-hosting/advanced/migrating-surveys))

## 4. Revisions, and making a new form from an old one

**Form.io** is the only product here with a documented revision log of the form itself. Enabling it (Advanced Settings → Form Revisions) offers two modes: show submissions with the current form, or with the revision that captured them. Each publish increments `vid`. **Restore** "make[s] a clone of the current revision, iterating the Vid to the most recent revision." The editor opens on that clone; the old vid stays. One draft at a time; publishing the draft removes it from the list. Restore does not create a new form id. A nested child can be pinned to a vid, and "Use Original Revision while Submissions Viewing" keeps the vid that produced a submission. ([Form Revisions](https://help.form.io/form-building/form-revisions), [Nested forms](https://help.form.io/form-building/nested-forms))

**Fillout** restore is edit history on the same form: clock icon, then Restore. The article does not say a new form is created, and it does not say responses are touched. ([Restore previous version](https://www.fillout.com/help/restore-previous-version))

**Formbricks** has no revision table in the copy path. Duplicate always starts from the survey row as read now, writes a new id, and sets `draft`. There is no argument for "copy revision N". The migration API likewise copies the current document. ([survey.ts L244–326](https://github.com/formbricks/formbricks/blob/a2bd102/apps/web/modules/survey/list/lib/survey.ts#L244-L326))

**SurveyJS** has no server-side revision. The host can store whatever `toJSON()` returned.

**Typeform** distinguishes a live form from unpublished edits ("If you're editing a form that's already live, Typeform AI applies the change, but in draft. The live form doesn't change until you click Publish edits."). That is a draft overlay, not a list of old published versions you can fork. ([Typeform AI](https://help.typeform.com/hc/en-us/articles/42053773420948-Use-Typeform-AI))

None of the products document "create a new form whose content is exactly published version N and whose responses stay on the old form" as a named operation. The closest are: Form.io restore (same form, new vid, old submissions still viewable on their vid), Formbricks duplicate (new form, current content, no responses, element ids kept), and Fillout duplicate (new form, "identical", different link).

## 5. What this means for Formidabile

The current definition is one object for a draft and for a published version: `format: 1`, a title, an optional description, and an ordered list of question snapshots. Question `id` is a UUID "minted by the builder, kept across versions while the question keeps its meaning." Option `value`s are minted by the builder, not derived from the label. The schema is `strictObject` plus `format: z.literal(1)`. Readers accept every format ever written; published versions are never migrated. ([form-definition.ts L32–40](../../../packages/core/lib/definition/form-definition.ts), [question-type.ts L29–31](../../../packages/core/lib/definition/question-type.ts), [ADR-005](../../../docs/adr/0005-form-definition-model.md))

One draft per form. A response is against one published version. Combined analytics group by question identity and never split one identity automatically; "treat as a new question" mints a fresh identity and keeps option values. A form that has any published version cannot be deleted. A never-published form can. Discarding the draft of a never-published form is refused, so a form always has a draft, a published version, or both. ([ADR-002](../../../docs/adr/0002-mvp-product-calls.md), [ADR-009](../../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md), [ADR-014](../../../docs/adr/0014-only-never-published-forms-can-be-deleted.md))

There is no conditional logic and no hidden fields in the MVP, so a copy does not have Typeform `ref`s or Tally block-UUID logic to remap. The only cross-references inside a definition today are: question ids must be unique in the list, and option values must be unique within a question.

### A copied form shares no history

Identity means "these versions of **this** form are the same question" ([ADR-009](../../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md)). A duplicate is a different form: Formbricks, Jotform, Fillout and Typeform all describe the result as a new form whose later edits do not affect the original, and none of them attach the original's responses (Formbricks' *migration* does, and that is why it keeps element ids).

What products do with ids:

- **Formbricks keeps them** on both duplicate and migration. Duplicate does it by `structuredClone` of `blocks` with no remap ([survey.ts L327–328](https://github.com/formbricks/formbricks/blob/a2bd102/apps/web/modules/survey/list/lib/survey.ts#L327-L328)). Migration documents why: answers are keyed by element id, and a response replay fails if the ids change. Choice *answers* are labels, not ids.
- **Typeform logic uses author-chosen `ref`s.** System field ids exist; the duplicate help text never says they are regenerated.
- **Tally logic uses block UUIDs the client sends.** A copied block list keeps working if those UUIDs are copied with it.
- **SurveyJS** puts the data key (`name`) in the JSON the host copies. No server remap is documented.
- **Form.io** `key` is inside the JSON. A nested form does not copy keys at all; it points at the child form id, so a change to the child shows up in every parent.
- **Google and Jotform** do not document field-id behaviour on copy. Google's API will not accept items on create, so the server assigns item ids when items are added later.

Tradeoff that follows, not a decision: if a new Formidabile form is created by copying a definition and the question UUIDs are kept, those ids are the analytics-compatibility claim. [ADR-009](../../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md) says combined analytics group by question identity and never split one identity automatically. [ADR-001 §8.2](../../../docs/adr/0001-modular-versioned-form-management.md) says those combined views are of a question that keeps its identity across versions, and that response counts are also grouped by form version. It does not say an identity is unique to one form, and the definition schema only rejects a duplicate id inside one definition (`form-definition.ts`). Kept ids would join two forms' answers if a query grouped by identity alone. Keeping ids is what Formbricks does because their copy and their response import share one code path. Minting new ids is what "treat as a new question" already does inside one form, and a duplicate is a stronger break than that. Option values are not identities; ADR-009's "treat as a new question" keeps them, and a copy can do the same.

### A version is not a template

A Formidabile version is immutable, self-contained, and tied to the responses collected against it. Every product that has revisions uses them to move the *same* form (Form.io's new vid, Fillout's restore). Every product that has templates uses them to create a *different* form and leaves the source alone (Typeform, Tally, Fillout, Jotform, Formbricks catalog). Form.io's project template is a third thing: a bag of many forms, explicitly not their submissions.

So "start a form from version N of form A" is a template operation: new form, no responses, not version N+1 of A. "Put version N back into the draft of A" is a restore. Form.io refuses to overwrite the old vid; it appends a vid. Formidabile already has a single draft, so a restore cannot be a second draft. It would replace that draft's definition. Publishing it would create the next version. The old version stays, which is the ADR-005 rule that published versions are never rewritten.

### One draft, and deletion

A duplicate that creates a **new** form (what Typeform, Jotform, Fillout and Formbricks do) is never-published until someone publishes it, so ADR-014 allows deleting it. A restore that only rewrites the one draft of an already published form does not create anything deletable, and the form itself still cannot be deleted.

Tally's API can create a form already `PUBLISHED`. Formbricks' duplicate cannot: it forces `draft`. Typeform's AI edits to a live form stay in draft until Publish edits. A Formidabile "create from template" that inserted a published version immediately would skip the draft and would make a form that cannot be deleted. The products that distinguish the two states start unpublished.

### Who stores the template

SurveyJS and Form.io do not own a gallery. The host keeps JSON and posts or loads it. Typeform, Tally, Jotform, Fillout and Google store the gallery themselves. Formbricks does both: a `catalog` source and a `custom` source, plus `xm`.

Formidabile's definition is already the whole content of a draft. A host that can save a draft can hold a template outside the module and submit that JSON as a new form's draft. A gallery inside the module would be a second store of definitions, which none of the open-source libraries require and which the hosted products use because they *are* the account system.

Cross-tenant sharing, from what the copies actually strip:

- Typeform's cross-organization copy drops results, follow-ups, custom system messages and meta, and clears signature BCC recipients. It still copies "structure", which is enough to move question text into another organization. Only an organization owner can do it.
- Jotform's URL clone is deliberately possible across accounts, and the owner has to opt out (Prevent Cloning, or private / password). The in-account clone copies email recipients; the URL clone resets them. Encryption is forced off in both.
- Formbricks' cross-workspace copy stays inside an organization, drops responses, may drop CSS, and will not carry `replace` head-script mode. A public segment is shared only when the copy stays in the same workspace.
- Form.io's nested form shares a live child. Exporting a project template copies forms and resources, not submissions. A `form` component's child id will dangle if the child was not in the export.
- Fillout's third-party import copies notification recipients.

A Formidabile definition does not contain external references, grants, responses or integration credentials. Those already live outside it. The leak that still fits in the definition is the question text itself, plus question UUIDs if they are treated as global. A template crossing tenants is a definition with new question ids.

### Format number

`format` is the literal `1`, and the object is strict, so an import of a definition with another format number, or with keys the schema does not know, fails `parseDefinition`. ADR-005 says readers accept every format ever written and do not rewrite published versions. A template is not a published version. It is an input to a draft. If a future format 2 is added, old templates at format 1 still have to parse, which is the same rule as old versions. Nothing read here versions the *file* separately from the definition: Typeform and SurveyJS have no format integer, Tally pins the HTTP API by date, Form.io versions the database. Formidabile already has the integer on the definition, so an exported template that omits `format` will not parse.

### AI, if the module stays host-agnostic

Documented behaviour of AI as a starting point:

- **Typeform.** Input is a prompt, pasted questions, voice, a URL or company name (the model searches the web), or up to 3 files of 20 MB (pdf, office, csv, json, yaml, and others). Free plan: 40 messages/day, 70/week, 100/month, and 1 file upload per billing month. Paid: no monthly upload cap. Connectors that pull other apps are Business and above. Extended Thinking is Enterprise and Growth Custom, 50 prompts/month. Output is applied to the form draft; View details lists adds, removes and changes; Undo reverses the last AI change. A live form is not changed until Publish edits. A warning is shown before a change that "could affect responses, logic, mappings, or other parts of your form." Memory is per user, seeded from onboarding and "enrichment services", editable, capped at 2,000 characters, and follows the user across workspaces. The article does not say prompts are excluded from model training. ([Typeform AI](https://help.typeform.com/hc/en-us/articles/42053773420948-Use-Typeform-AI))
- **Tally.** "A plain-language prompt, or [a] screenshot or PDF shared directly in the chat, logic, structure, and branding included." File import of a PDF or image is a separate path and does not extract logic. No data-handling statement on that page. Importing is free. ([Import](https://tally.so/help/import))
- **Google.** A prompt, and for Experiments / Gemini Beta users also Drive, Chat, web and Gmail, or a specific Doc, Sheet, Slide or PDF. Output is a generated draft; Create form (or Create quiz) commits it. Recreate throws away the previous generation. Not supported: quiz settings, multiple sections, and editing an existing form (it replaces the form). "Don't rely on Gemini features as medical, legal, financial or other professional advice." Enterprise feedback "shouldn't contain personal, sensitive, or confidential information." ([Gemini](https://support.google.com/docs/answer/16346789?hl=en))
- **Jotform.** Prompt plus a public form URL or a form name. Result is a copy with a new name, editable by further prompts or in Form Builder. Private forms are refused. No training statement in the article. ([AI import](https://www.jotform.com/help/how-to-import-forms-with-jotform-ai/))
- **Fillout.** Prompt, one question per line, a form URL (Google Forms, Typeform, Jotform, SurveyMonkey, Tally, Paperform), or a PDF. "You can bulk import forms, including their responses" is a tip on the AI page; the import article says a Fillout-file import does not include submissions. The author then publishes. The AI article calls the builder free. A help page titled Turn off AI is listed in the help index; its body was not read, so what that switch covers is unverified. ([AI forms](https://www.fillout.com/help/ai-forms), [Turn off AI](https://www.fillout.com/help/disable-ai), [Import, export](https://www.fillout.com/help/importing-and-exporting-forms), [llms.txt](https://www.fillout.com/help/llms.txt))
- **Formbricks.** Enterprise only, off until an Owner or Manager enables Smart functionality. Prompt length 4–1,200 characters. The UI generates, shows a draft, and only then "Open in editor" (the persisted status of that save was not in the component read). Regenerate keeps the previous draft available via Back to draft. Current Smart Functionality model: "Gemini 3.5 Flash hosted on Google Cloud Platform in Germany." Embeddings for feedback search are hosted by Formbricks, and "your collected feedback/response data is never used as AI training input" for that capability. The survey-creation model is the Gemini one, not the embeddings one. Qualtrics `.qsf` import "turn[s] a Qualtrics survey export into a draft survey." ([AI features](https://formbricks.com/docs/platform/features/ai-features), [ai-create-utils.ts](https://github.com/formbricks/formbricks/blob/main/apps/web/modules/survey/components/template-list/lib/ai-create-utils.ts), [create-with-ai-form.tsx](https://github.com/formbricks/formbricks/blob/main/apps/web/modules/survey/components/template-list/components/create-with-ai-form.tsx))

"The module never authenticates anyone. The host signs a JWT for each request, and the module checks it and enforces tenants and capabilities itself." ([docs/embedding.md](../../../docs/embedding.md)) Every AI path above sends the prompt, and sometimes files or connected-account context, to a model the form vendor runs. Formbricks is the only one that documents an off switch tied to self-hosting and a region for the model, and even then survey creation is Gemini in the vendor's GCP project, while the "not used for training" sentence is about feedback embeddings. A host-agnostic module that called a model itself would be choosing a processor the host did not deploy. A host that already calls a model can hand the module a definition of `format: 1` and stop there: that is the same shape as Tally's `POST /forms` and Formbricks' `POST /api/v3/surveys`, and the module's strict schema is the check those APIs do with their own validators.

### Open questions for the owner

1. On duplicate, mint new question ids, or keep them? Formbricks keeps element ids even when it does not copy responses. ADR-009's claim is per form across versions. Whether any analytics query groups by identity alone, without a form id, decides if kept ids would merge two forms.
2. Is "edit a copy of version N" a new form (deletable until published, one draft of its own) or a replacement of the single draft of the same form (the Form.io/Fillout restore shape)? Both cannot be a second draft.
3. Does the module store templates, or only accept a definition the host already stored and posted? The open-source libraries do the latter. The hosted products do the former because they are the account system.
4. May a template cross tenants? The copies that allow it strip responses and, in some cases, recipients and secrets, and still copy question text. They do not agree about ids.
5. Should AI live in the module at all? The documented vendors run the model themselves, gate it, and (Formbricks, Fillout) let the organization turn it off. The output, when specified, is a normal draft the author publishes.
6. An imported definition has to be `format: 1` and strict. Is a template allowed to omit `format`, or is a missing format a hard error, the same as Formbricks rejecting unknown keys?

## Could not verify

- Typeform UI duplicate: whether logic, theme, integrations, hidden fields and variables are copied; whether field ids and `ref`s are regenerated. The Retrieve form response body was not re-read, so it is not confirmed to match the Create body.
- Typeform: a user-saved or organization template library, separate from copying a form between workspaces.
- Typeform AI: whether prompts or uploads are used to train models. The help article does not say.
- Tally: a Duplicate control in the editor. Help search returned settings for preventing duplicate *submissions*, not copying a form. Also unstated: whether `POST /forms` rejects block UUIDs that already exist, and any AI data-handling statement.
- Tally within-form page duplicate. A help search snippet mentioned folding a page to duplicate it; that article was not opened.
- Google Make a copy: whether responses, the linked spreadsheet, item ids, or the published/unpublished state are copied. Apps Script has no `Form.copy()` in the class reference read.
- Google: an organization template gallery ("Submit template") as an official help page. What turned up were community threads, which this note does not use.
- Google Forms API: the full `Form` JSON schema. Only `forms.create`'s restrictions were read.
- Jotform: field-id regeneration on clone; copying individual questions between forms; a user-saved template distinct from Clone; a versioned form-definition schema; any write endpoint that creates a form from JSON. The properties reference was not read through.
- Jotform AI: a from-scratch generator separate from the import-by-URL article.
- Fillout duplicate: logic, theme, integrations, responses, ids. The article only says identical forms and different links. The export file's format (JSON or otherwise) and schema version. Whether "bulk import forms, including their responses" on the AI page contradicts the import article's "submissions not included" for a Fillout file, or refers only to third-party imports.
- Fillout private templates: the page says to set them Public "for now" and that a better private version is unfinished. What "private" does today was not specified beyond that note.
- Fillout "Turn off AI": the page is listed in the help index. Its body was not read, so what the switch disables was not verified.
- Formbricks: the template catalog JSON and whether a template's element ids are reused on every "use template"; the persisted status after "Open in editor"; an in-app JSON file export. PR #6869, which would have added one, was closed unmerged. SHA of `main` for the template and AI files (rate-limited). The copy function was read at `a2bd102`, which was the latest commit on that file in the history page, not necessarily `HEAD`.
- SurveyJS: `clone`'s treatment of `name`; any `survey.version` or schema-version field; a commercial hosted template gallery outside the open-source Creator docs.
- Form.io: a "duplicate form" action in the application source; the HTTP path and body for creating one form from JSON (as opposed to a project template upload); how Existing Resource Fields are copied onto a form.
- Whether Formidabile analytics queries are scoped by form id as well as question identity. ADR-009 describes the grouping; the query code was not read.
