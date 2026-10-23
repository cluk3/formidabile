# Form structure: pages, sequence, endings, prefill

Researched 2026-10-22. How leading builders structure a form for the respondent (pages, one-at-a-time versus everything at once, progress, welcome and ending screens, hidden fields, prefill, back/next, review, submit), and what that implies for a versioned, immutable, embeddable definition.

This note does not survey question types, conditional-logic rule shapes, or validation constraint models. Those are sibling notes. Logic is mentioned only where it chooses a page or an ending.

Sources read:

- **Typeform.** Help Center: [Welcome Screen](https://help.typeform.com/hc/en-us/articles/360052366812-Welcome-Screen), [Using URL parameters (formerly Hidden Fields)](https://help.typeform.com/hc/en-us/articles/360052676612-Using-URL-parameters-formerly-Hidden-Fields), [End Screens and redirects](https://help.typeform.com/hc/en-us/articles/360052366872-End-Screens-and-redirects) (fetched earlier this session), [How to add multiple questions to a form page](https://help.typeform.com/hc/en-us/articles/360051998891-How-to-add-multiple-questions-to-a-form-page), [Activate the Progress bar](https://help.typeform.com/hc/en-us/articles/360051557892-Activate-the-Progress-bar), [Collect partial responses](https://help.typeform.com/hc/en-us/articles/360052407512-Collect-partial-responses). Create API [create-form reference](https://developers.typeform.com/developers/create/reference/create-form/) and [example webhook payload](https://developers.typeform.com/developers/webhooks/example-payload/). The developer URL-parameters guide was fetched but the body did not come through (see Could not verify).
- **Tally.** Help: [Create a multi-page form](https://tally.so/help/multi-page-forms), [Hidden fields](https://tally.so/help/hidden-fields), [Thank you page](https://tally.so/help/how-to-create-a-thank-you-page) (search snippet plus the multi-page article). API: [POST /forms](https://developers.tally.so/api-reference/endpoint/forms/post) OpenAPI (`PageBreakBlock`, `HiddenFieldsBlock`, `FormSettings`), read in full this session. Submissions endpoint did not load.
- **Google Forms.** [Edit your form](https://support.google.com/docs/answer/2839737) (sections, shuffle, autosave). [Publish and share](https://support.google.com/docs/answer/2839588) (confirmation message, pre-filled link, results summary). API: [REST Resource: forms](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms) and [forms.responses](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms.responses).
- **Jotform.** [API docs](https://api.jotform.com/docs/) (`POST /user/forms`, `GET /form/{id}/questions`, `POST /form/{id}/properties`). Card-form and multi-page help URLs 404'd or returned the wrong article.
- **Fillout.** Help, fetched 2026-10-22: [page types](https://www.fillout.com/help/page-types), [ending page](https://www.fillout.com/help/ending-page), [progress bar](https://www.fillout.com/help/progress-bar), [review page](https://www.fillout.com/help/review-page), [partial submissions](https://www.fillout.com/help/partial-submissions), [URL parameters](https://www.fillout.com/help/url-parameters), [pre-fill fields](https://www.fillout.com/help/prefill-fields). No public form JSON schema was read.
- **Formbricks.** Source at commit [`b787dc04`](https://github.com/formbricks/formbricks/commit/b787dc04c35de1514a5841db483003aef1d72b92) (2026-10-22): `packages/types/surveys/types.ts`, `blocks.ts`, `elements.ts`. Docs: [Thank you card](https://formbricks.com/docs/surveys/question-type/thank-you-card), [Hidden fields](https://formbricks.com/docs/surveys/general-features/hidden-fields), [Partial submissions](https://formbricks.com/docs/surveys/general-features/partial-submissions), [Data prefilling](https://formbricks.com/docs/surveys/link-surveys/data-prefilling), [Start at a block](https://formbricks.com/docs/surveys/link-surveys/start-at-block).
- **SurveyJS.** [Create a Multi-Page Survey](https://surveyjs.io/form-library/documentation/design-survey/create-a-multi-page-survey), and `SurveyModel` in `survey-library` (`survey.ts` as fetched 2026-10-22; JSDoc matches the [survey-data-model](https://surveyjs.io/form-library/documentation/api-reference/survey-data-model) reference). The git tag of that file was not retained.
- **Form.io.** [Form types](https://help.form.io/userguide/forms/form-types). Source tag [`v5.7.0`](https://github.com/formio/formio.js/releases/tag/v5.7.0): `src/Form.js`, `src/Wizard.js`, `src/components/hidden/Hidden.js`.
- **W3C.** [Multi-page forms tutorial](https://www.w3.org/WAI/tutorials/forms/multi-page/). Understanding docs for [2.4.2](https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html), [2.4.3](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html), [3.2.2](https://www.w3.org/WAI/WCAG22/Understanding/on-input.html), [3.2.3](https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html), [3.3.1](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html).
- **This module.** [ADR-002](../../../docs/adr/0002-mvp-product-calls.md), [ADR-005](../../../docs/adr/0005-form-definition-model.md), [ADR-009](../../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md), [embedding](../../../docs/embedding.md), `packages/core/src/lib/definition/form-definition.ts`.

## 1. Summary

Rows are structural features. A cell is a documented fact with a source, or **unverified**. Plan gates are inline.

| Feature | Typeform | Tally | Google Forms | Jotform | Fillout | Formbricks | SurveyJS | Form.io |
|---|---|---|---|---|---|---|---|---|
| Pages / sections | Each question or statement is a page. Several questions can share one page ([multi-question pages](https://help.typeform.com/hc/en-us/articles/360051998891-How-to-add-multiple-questions-to-a-form-page)). | Flat block list. A `PAGE_BREAK` block starts a page. Default is one page ([help](https://tally.so/help/multi-page-forms), [schema](https://developers.tally.so/api-reference/endpoint/forms/post)). | `pageBreakItem` starts a section. Up to 75 sections ([API](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms#PageBreakItem), [help](https://support.google.com/docs/answer/2839737)). | **Unverified.** API is a flat question map with `order` ([docs](https://api.jotform.com/docs/)). | First-class pages. New forms start as one Form page plus an Ending ([page types](https://www.fillout.com/help/page-types)). | A **block** is the screen and holds one or more elements. Legacy surveys use a `questions` array instead, not both ([`types.ts`](https://github.com/formbricks/formbricks/blob/b787dc04c35de1514a5841db483003aef1d72b92/packages/types/surveys/types.ts), [`blocks.ts`](https://github.com/formbricks/formbricks/blob/b787dc04c35de1514a5841db483003aef1d72b92/packages/types/surveys/blocks.ts)). | `pages[]`, each with `elements`. Pages do not nest ([tutorial](https://surveyjs.io/form-library/documentation/design-survey/create-a-multi-page-survey)). | Wizard pages **are** Panel components. `display` is `form`, `wizard`, or `pdf` ([docs](https://help.form.io/userguide/forms/form-types), [`Form.js`](https://github.com/formio/formio.js/blob/v5.7.0/src/Form.js)). |
| Nested groups / panels | `group` fields nest questions and show them one at a time (`1a`, `1b`). A multi-question page shows them together (`A`, `B`) ([same help](https://help.typeform.com/hc/en-us/articles/360051998891-How-to-add-multiple-questions-to-a-form-page), [create-form `group`](https://developers.typeform.com/developers/create/reference/create-form/)). | `groupUuid` groups child blocks (options under a question). Columns sit side by side. Not nested pages ([schema](https://developers.tally.so/api-reference/endpoint/forms/post)). | `questionGroupItem` is a grid: rows are questions, columns are shared choices ([API](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms#QuestionGroupItem)). | **Unverified.** | Section collapse groups questions on a page ([index](https://www.fillout.com/help/llms.txt) lists [section collapse](https://www.fillout.com/help/section-collapse); that page itself was not read). | Elements nest in a block only. Blocks do not nest ([`ZSurveyBlock`](https://github.com/formbricks/formbricks/blob/b787dc04c35de1514a5841db483003aef1d72b92/packages/types/surveys/blocks.ts)). | Panels nest inside pages; panels can nest. Pages cannot ([tutorial](https://surveyjs.io/form-library/documentation/design-survey/create-a-multi-page-survey)). | Panels, columns, tabs, and nested wizards exist in `Wizard.js` (`subWizards`). Depth beyond "wizard page = panel" was not read. |
| One-per-screen | Default: one question per page. Opt in to several on a page ([help](https://help.typeform.com/hc/en-us/articles/360051998891-How-to-add-multiple-questions-to-a-form-page)). | Opt in: a page break after every question. Otherwise many questions per page ([help](https://tally.so/help/multi-page-forms)). | No. A section holds many items ([API](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms#PageBreakItem)). | **Unverified** (card layout help 404). | No. A Form page holds the questions; extra pages are added explicitly ([page types](https://www.fillout.com/help/page-types)). | The block is the screen. `startAt` shows every question in that block together ([start-at](https://formbricks.com/docs/surveys/link-surveys/start-at-block)). | `questionsOnPageMode`: `standard` (default), `singlePage`, `questionPerPage`, `inputPerPage` (source property metadata). | Wizard shows one panel at a time. The panel can hold many fields ([docs](https://help.form.io/userguide/forms/form-types)). Web form shows all. |
| Progress indicator | Horizontal bar at the top. API `progress_bar`: `percentage` or `proportion`. Branching makes the fill jump; they say turn it off then ([help](https://help.typeform.com/hc/en-us/articles/360051557892-Activate-the-Progress-bar), [settings](https://developers.typeform.com/developers/create/reference/create-form/)). | `hasProgressBar` (default false). Help: Settings, General ([schema](https://developers.tally.so/api-reference/endpoint/forms/post), [help](https://tally.so/help/multi-page-forms)). | **Unverified.** Not in `FormSettings`. The help URL tried for it 404'd. | **Unverified.** | Default thin bar at the top. Optional stepped bar, 3 steps by default, up to 5, named per page ([progress](https://www.fillout.com/help/progress-bar)). | **Unverified.** No progress field in the `ZSurveyBase` fields read. | `showProgressBar` default false. `progressBarType`: `pages` (default), `questions`, `requiredQuestions`, `correctQuestions`. In `questionPerPage`, `pages` falls back to `questions` (source `getEffectiveProgressBarType`). | Step breadcrumbs. With header type `StepIndicator`, a screen reader hears "Now on step N of M: title" ([`Wizard.js` `announceCurrentPage`](https://github.com/formio/formio.js/blob/v5.7.0/src/Wizard.js)). No percent bar in the files read. |
| Welcome screen | `welcome_screens[]`. Help: one per form, with a Start button (max 24 characters) ([help](https://help.typeform.com/hc/en-us/articles/360052366812-Welcome-Screen)). | No separate welcome type. `FORM_TITLE` is the title on the form ([schema](https://developers.tally.so/api-reference/endpoint/forms/post)). | `info.title` and `info.description` on the form, not a separate screen ([API](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms#Info)). | **Unverified.** | Cover page, optional ([page types](https://www.fillout.com/help/page-types)). The cover-page article itself was not read. | `welcomeCard` (`enabled`, headline required when enabled, button, time-to-finish, response count) ([`ZSurveyWelcomeCard`](https://github.com/formbricks/formbricks/blob/b787dc04c35de1514a5841db483003aef1d72b92/packages/types/surveys/types.ts)). | First `pages[]` entry plus `firstPageIsStartPage`. It is not a step, and the respondent cannot return to it ([tutorial](https://surveyjs.io/form-library/documentation/design-survey/create-a-multi-page-survey)). | **Not found** in the form-types doc or `Form.js` header. |
| Multiple ending screens | `thankyou_screens[]`. Logic shows one. Deleting them all shows a default screen ([help](https://help.typeform.com/hc/en-us/articles/360052366872-End-Screens-and-redirects), [API](https://developers.typeform.com/developers/create/reference/create-form/)). | Help describes one thank-you page (`/thank` or a toggle on the last page). Schema: `isThankYouPage` on a page break ([help](https://tally.so/help/multi-page-forms), [schema](https://developers.tally.so/api-reference/endpoint/forms/post)). More than one: **unverified**. | One confirmation message ([help](https://support.google.com/docs/answer/2839588)). | One form property. `activeRedirect=thankurl` plus `thankurl` ([API](https://api.jotform.com/docs/)). Multiple: **unverified**. | Many ending pages. Types: thank-you page, another form, or redirect ([ending](https://www.fillout.com/help/ending-page)). | `endings[]` of `endScreen` or `redirectToUrl`, each with its own id. Logic picks one ([schema](https://github.com/formbricks/formbricks/blob/b787dc04c35de1514a5841db483003aef1d72b92/packages/types/surveys/types.ts), [docs](https://formbricks.com/docs/surveys/question-type/thank-you-card)). | One complete page. `completedHtmlOnCondition[]` swaps its HTML. Not separate screens with ids ([tutorial](https://surveyjs.io/form-library/documentation/design-survey/create-a-multi-page-survey)). | **Not found.** |
| Per-ending redirect | Per screen: button URL, or a `url_redirect` screen that skips the thank-you. **Plus and above.** URL must be `https`. Embed opt-in `data-tf-redirect-target="_self"` ([help](https://help.typeform.com/hc/en-us/articles/360052366872-End-Screens-and-redirects)). | One form-level `redirectOnCompletion` (rich text). Not per ending ([schema](https://developers.tally.so/api-reference/endpoint/forms/post)). | **Not found.** | One `thankurl` ([API](https://api.jotform.com/docs/)). | Per ending: Redirect (leave Fillout) or New form (another form, can pass URL parameters) ([ending](https://www.fillout.com/help/ending-page)). | Per ending: `redirectToUrl.url`, or an end-screen button link. **Cloud paid** for custom external URLs; self-hosted is not restricted ([docs](https://formbricks.com/docs/surveys/question-type/thank-you-card)). | `navigateToUrl`, or `navigateToUrlOnCondition[]` of `{expression, url}` (source). | **Not found.** |
| Hidden fields | `hidden: string[]` of names. Passed on the **hash**, not the query (`#first_name=Fran&source=twitter`). Free. Stored on the response as `hidden` ([help](https://help.typeform.com/hc/en-us/articles/360052676612-Using-URL-parameters-formerly-Hidden-Fields), [webhook](https://developers.typeform.com/developers/webhooks/example-payload/)). | A `HIDDEN_FIELDS` block lists `{uuid, name}`. Values come from the **query** (`?name=Marie&ref=email`). Free ([help](https://tally.so/help/hidden-fields), [schema](https://developers.tally.so/api-reference/endpoint/forms/post)). | **Not in the Form resource.** | **Unverified.** | Registered URL parameters, called hidden fields. Query `?name=Jane+Doe` ([URL parameters](https://www.fillout.com/help/url-parameters)). | `hiddenFields: { enabled, fieldIds }`. Query keys. Names are now the passed-in half of embedded data ([schema](https://github.com/formbricks/formbricks/blob/b787dc04c35de1514a5841db483003aef1d72b92/packages/types/surveys/types.ts), [docs](https://formbricks.com/docs/surveys/general-features/hidden-fields)). | **No hidden-field type** in the survey model read. Invisible questions are a different mechanism (`clearInvisibleValues`). | Component `type: "hidden"`, rendered as `<input type="hidden">` ([`Hidden.js`](https://github.com/formio/formio.js/blob/v5.7.0/src/components/hidden/Hidden.js)). |
| URL prefill of visible questions | URL parameters fill **hidden** fields and can be recalled into text. Prefill of ordinary questions from the URL: **unverified**. | `defaultAnswer` on inputs, or a reference to another field, including a hidden field ([schema](https://developers.tally.so/api-reference/endpoint/forms/post)). The pre-populate help page was not read in full. | "Pre-fill form" builds a link with answers already filled ([help](https://support.google.com/docs/answer/2839588)). | **Unverified.** | Field default value, which may be a URL parameter. The help says the respondent can change it ([prefill](https://www.fillout.com/help/prefill-fields)). | `?questionId=answer` on a link survey. `skipPrefilled=true` hides those questions. Id is editable until the survey is activated, then fixed ([prefill](https://formbricks.com/docs/surveys/link-surveys/data-prefilling)). | Assign `survey.data` as `{ questionName: value }`. That replaces any previous data; `mergeData` merges ([API `data`](https://surveyjs.io/form-library/documentation/api-reference/survey-data-model#data)). | **Unverified.** |
| Review / summary before submit | **Not found.** | **Not found.** | **Not found** as a pre-submit step. "View results summary" shares a results summary **after** submit ([help](https://support.google.com/docs/answer/2839588)). | **Unverified.** | A Review page. Individual questions can be hidden from it ([review](https://www.fillout.com/help/review-page)). | **Not in the schema.** | `showPreviewBeforeComplete`. Preview shows visible pages as panels with Edit. `previewMode`: `allQuestions` or `answeredQuestions` ([tutorial](https://surveyjs.io/form-library/documentation/design-survey/create-a-multi-page-survey)). | **Not found.** |
| Back navigation | Arrows in the corner unless `hide_navigation` ([create-form settings](https://developers.typeform.com/developers/create/reference/create-form/)). Whether Back re-validates: **unverified**. | **Unverified.** `pageAutoJump` only goes forward ([help](https://tally.so/help/multi-page-forms)). | **Unverified.** `goToAction` `RESTART_FORM` is branching, not Back ([API](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms#GoToAction)). | **Unverified.** | **Unverified.** | `isBackButtonHidden`. Each block may set `backButtonLabel` ([schema](https://github.com/formbricks/formbricks/blob/b787dc04c35de1514a5841db483003aef1d72b92/packages/types/surveys/types.ts)). | `showPrevButton` default true. `prevPage()` does **not** validate ([tutorial](https://surveyjs.io/form-library/documentation/design-survey/create-a-multi-page-survey), source). | Previous button on by default. Breadcrumb clicks on pages not yet visited are off unless `allowPrevious` ([`Wizard.js` `init`](https://github.com/formio/formio.js/blob/v5.7.0/src/Wizard.js)). |
| Save-and-resume / partial responses | `autosave_progress`: client-side only ([settings](https://developers.typeform.com/developers/create/reference/create-form/)). Separate **Partial Submit Points** write a server response. **Basic+** (1 point); **Business / Growth / Enterprise** up to 3. Not in the mobile builder ([help](https://help.typeform.com/hc/en-us/articles/360052407512-Collect-partial-responses)). | `hasPartialSubmissions` default false. `saveForLater` default **true** ([schema](https://developers.tally.so/api-reference/endpoint/forms/post)). What the respondent sees for save-for-later: **unverified**. | Drafts autosave for 30 days after the last edit, or until submit. Can be disabled. Called out for embedded and shared-device forms ([help](https://support.google.com/docs/answer/2839737)). | **Unverified.** | Respondents can resume on **every** plan. The builder's "in progress" list is **Business, Team, Enterprise** ([partial](https://www.fillout.com/help/partial-submissions)). | On for every survey: "display created", then answers recorded as the respondent goes ([docs](https://formbricks.com/docs/surveys/general-features/partial-submissions)). | No server resume in the library. `cookieName` only remembers that this browser finished. Saving is the host's `onComplete` / save callbacks (source comment on `showCompletePage`). | **Unverified** in the files read. |
| Per-page validation gating | Required is per field ([create-form `validations.required`](https://developers.typeform.com/developers/create/reference/create-form/)). A partial submit is collected only if the question before the point was answered ([help](https://help.typeform.com/hc/en-us/articles/360052407512-Collect-partial-responses)). Whether Next blocks on invalid input: **unverified**. | **Unverified.** `isRequired` exists on field payloads. | `Question.required` must be answered to submit ([API](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms#Question)). Whether Next on a section blocks: **unverified**. | **Unverified.** | **Unverified.** A validation help page exists and was not read. | `required` on each element. Whether Next is blocked until the block is valid: **unverified** (renderer not read). | Default `checkErrorsMode: "onNextPage"` validates before leaving the page. `"onComplete"` allows paging and then jumps to the first error. `"onValueChanged"` validates as values change (source). | `nextPage()` validates the current page and stays put when it fails. Read-only wizards skip that ([`Wizard.js` `nextPage`](https://github.com/formio/formio.js/blob/v5.7.0/src/Wizard.js)). |
| Per-page titles / descriptions | A multi-question page can have a header and description. A single question uses its own title. Welcome and end screens have titles ([multi-question help](https://help.typeform.com/hc/en-us/articles/360051998891-How-to-add-multiple-questions-to-a-form-page)). | Page-break `name`, plus the button label ([schema](https://developers.tally.so/api-reference/endpoint/forms/post)). | The page break's `title` and `description` are shown at the top of the new page ([API](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms#PageBreakItem)). | **Unverified.** | Pages have names in the editor (copy, reorder). What the respondent sees as a page title: **unverified**. | `block.name` is required; the schema comment says it is for the **editor**. Respondent copy is the element `headline` / `subheader` ([`blocks.ts`](https://github.com/formbricks/formbricks/blob/b787dc04c35de1514a5841db483003aef1d72b92/packages/types/surveys/blocks.ts), [`elements.ts`](https://github.com/formbricks/formbricks/blob/b787dc04c35de1514a5841db483003aef1d72b92/packages/types/surveys/elements.ts)). | Page `title` / description. `showPageTitles` default true. Progress can show `navigationTitle` and `navigationDescription` (source). | Panel `title` is what `announceCurrentPage` speaks ([`Wizard.js`](https://github.com/formio/formio.js/blob/v5.7.0/src/Wizard.js)). |
| Randomised order of questions / pages | **Choices** can be randomised (`properties.randomize`). No setting found for question or page order. | **Options** (`randomize` on the first option) and matrix **rows** (`randomizeRows`). No page shuffle in the schema. | **Shuffle question order** (once per email address) and per-question **Shuffle option order**. Grids can shuffle rows ([help](https://support.google.com/docs/answer/2839737), [API `shuffle` / `shuffleQuestions`](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms)). Section order: **not found**. | **Unverified.** | **Not found** in the pages read. | Choice `shuffleOption` (`none`, `all`, `exceptLast`, and reverse variants) on the element ([`elements.ts`](https://github.com/formbricks/formbricks/blob/b787dc04c35de1514a5841db483003aef1d72b92/packages/types/surveys/elements.ts)). Block order: **not found**. | `questionOrder`: `initial` (default) or `random`, overridable on a page or panel (source). Page order: **not found**. | **Not found** in the files read. |

## 2. How the structure is stored

### Typeform

Three arrays on the form, plus a flat field list. Welcome and thank-you screens are not fields.

```json
{
  "welcome_screens": [{ "ref": "nice-readable-welcome-ref", "title": "Welcome Title" }],
  "fields": [
    { "ref": "nice_readable_short_text_reference", "type": "short_text", "title": "Short Text Title" },
    {
      "ref": "a_group_field_ref",
      "type": "group",
      "properties": { "fields": [{ "ref": "another_nice_readable_website_reference", "type": "website" }] }
    }
  ],
  "hidden": ["var1", "var2"],
  "thankyou_screens": [
    { "ref": "nice-readable-thank-you-ref", "title": "Thank you Title", "type": "thankyou_screen" }
  ]
}
```

From the [create-form example](https://developers.typeform.com/developers/create/reference/create-form/). There is no `pages` array. A "page" is either one field, a run of fields the builder has grouped onto one screen, or a `group`. The multi-question page is a builder grouping; the public example does not show a distinct page object for it.

Ids:

- Field `id` is assigned by Typeform and is what an answer points at (`answers[].field.id`). `ref` is the caller's stable name (`^[a-zA-Z0-9_-]+$`, under 255 characters). If you omit `ref`, the webhook's `ref` is regenerated on every payload ([webhook field table](https://developers.typeform.com/developers/webhooks/example-payload/)).
- Welcome and thank-you screens have `ref`. The webhook's `ending` is `{ id, ref }`, matched back to `definition.endings`.
- Hidden fields are names, not ids. The response stores `hidden: { user_id: "abc123456" }`.
- Unanswered questions are omitted, including questions skipped by logic ([webhook, "empty" answers](https://developers.typeform.com/developers/webhooks/example-payload/)).

Answers do not use position. The webhook text says the order of `definition.fields` matches the order of `answers`, but each answer still carries `field.id`.

### Tally

One flat `blocks` array, at most 65536 items. A page is the span between `PAGE_BREAK` blocks.

```json
{
  "uuid": "…",
  "type": "PAGE_BREAK",
  "groupUuid": "…",
  "groupType": "PAGE_BREAK",
  "payload": {
    "index": 0,
    "isFirst": true,
    "isLast": false,
    "isThankYouPage": false,
    "button": { "label": "Next" }
  }
}
```

Child pieces of one question (each multiple-choice option, each matrix row) are their own blocks, tied together by `groupUuid` ([schema description of `GroupUuid`](https://developers.tally.so/api-reference/endpoint/forms/post)).

Ids: every block has a UUID. Hidden fields are `{ uuid, name }` inside one `HIDDEN_FIELDS` block. The `name` is the query key. How a submission JSON keys answers: **unverified** (submissions endpoint did not load). The help says hidden values show up in the Submissions tab ([hidden fields](https://tally.so/help/hidden-fields)).

Form-level structure lives in `settings`, not in blocks: `hasProgressBar`, `hasPartialSubmissions`, `pageAutoJump`, `saveForLater` (default true), `redirectOnCompletion`.

### Google Forms

One flat `items` array. A section is not a container. A `pageBreakItem` is an item that starts a new page; items after it belong to that page until the next break.

```json
{
  "itemId": "…",
  "title": "Shipping",
  "description": "Where should we send it?",
  "pageBreakItem": {}
}
```

`pageBreakItem` has no fields of its own. Title and description are the item's, and they are shown at the top of the new page ([API](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms#PageBreakItem)).

Ids:

- `itemId` identifies the item (the section header, the question item, the image). The caller may supply one if it is unused.
- `questionId` identifies the question. It is read-only once set. A grid row is its own question.
- `answers` on a response is a map **keyed by `questionId`** ([FormResponse](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms.responses#FormResponse)). Position is not the key.
- Choice answers store the option's `value` string, which is also the label the respondent saw. There is no separate stable option id in this resource.

`FormSettings` in the API is only `quizSettings` and `emailCollectionType`. Progress, confirmation text, and shuffle are not in that object. Shuffle is `ChoiceQuestion.shuffle` and `Grid.shuffleQuestions`, and the help documents a form-level "Shuffle question order".

### Jotform

What was verified is a flat map, not pages.

`POST /user/forms` sends `questions[0][type]=control_head`, `questions[1][type]=control_textbox`, each with `text`, `order`, and `name`. `GET /form/{id}/questions` says type is the field type, **order is the question order**, and text is the label ([API](https://api.jotform.com/docs/)).

The thank-you redirect is a form property, not a screen object: `properties[thankurl]` and `properties[activeRedirect]=thankurl`.

Anything about card layout, page-break fields, or which id a submission uses: **unverified**. See the list at the end.

### Fillout

No JSON schema was read. From the help, a form is an ordered list of pages. A new form has one Form page and one Ending page. Further pages have a type: Form, Cover, Review, Payment, Login, Scheduling, Ending ([page types](https://www.fillout.com/help/page-types)). Order shown to the respondent is changed with page logic, not only by dragging ([same article](https://www.fillout.com/help/page-types)).

Ending pages are a different type, not a flag on the last form page ([ending](https://www.fillout.com/help/ending-page)). URL parameters are registered in form settings, not placed as blocks ([URL parameters](https://www.fillout.com/help/url-parameters)).

How answers are keyed, and whether page ids are stable: **unverified**.

### Formbricks

Two stored shapes. A survey must have `questions` or `blocks`, never both ([`surveyRefinement`](https://github.com/formbricks/formbricks/blob/b787dc04c35de1514a5841db483003aef1d72b92/packages/types/surveys/types.ts)).

Current shape:

```ts
{
  id: cuid2,
  name: string,            // "REQUIRED for editor"
  elements: Element[],     // at least one
  logic?: BlockLogic[],
  logicFallback?: BlockId,
  buttonLabel?: I18nString,
  backButtonLabel?: I18nString
}
```

An element id is a caller-chosen string: no spaces, `/^[a-zA-Z0-9_-]+$/`, and not a forbidden id ([`ZSurveyElementId`](https://github.com/formbricks/formbricks/blob/b787dc04c35de1514a5841db483003aef1d72b92/packages/types/surveys/elements.ts)). Block ids are cuids. Ending ids are cuids. Hidden-field ids are the same loose identifier character set, and **new** keys must match `^[a-z][a-z0-9_]*$/` ([hidden-field docs](https://formbricks.com/docs/surveys/general-features/hidden-fields)).

Welcome is a single object (`welcomeCard`), not a block. Endings are a separate array, not the last block.

Prefill and `startAt` use the **question id**. After activation that id is fixed, because stored responses already point at it ([prefill docs](https://formbricks.com/docs/surveys/link-surveys/data-prefilling)). `startAt=<question id>` opens the block that contains that question, not the question alone ([start-at](https://formbricks.com/docs/surveys/link-surveys/start-at-block)). So the block is the screen, and the element id is the answer key. Position is not the key.

### SurveyJS

```js
const surveyJson = {
  pages: [{
    name: "page1",
    elements: [
      { type: "radiogroup", name: "satisfaction-score", isRequired: true, choices: [/* … */] },
      { type: "panel", name: "details", elements: [/* questions */] }
    ]
  }],
  firstPageIsStartPage: false,
  showPreviewBeforeComplete: false,
  completedHtml: "Thank you for your feedback!"
};
```

The tutorial's model omits `name` on pages; the API addresses pages by name (`currentPage = "myCurrentPage"`, `getPageByName`). Pages contain elements. Elements are questions or panels. Panels contain elements. Pages do not contain pages ([tutorial](https://surveyjs.io/form-library/documentation/design-survey/create-a-multi-page-survey)).

`questionsOnPageMode` does not rewrite the JSON. `singlePage` flattens for display, `questionPerPage` shows one question at a time, `inputPerPage` splits matrixes and multiple-text questions into one input per screen, `standard` keeps the JSON structure (source property comment).

Answers: `survey.data` is `{ [questionName]: value }` ([API](https://surveyjs.io/form-library/documentation/api-reference/survey-data-model#data)). A question may set `valueName` to store under a different key. Position is not the key. `clearInvisibleValues` (default `"onComplete"`) drops values of hidden questions from that object when the survey completes.

The complete page is **not** a page in `pages`. It is `completedHtml` plus `completedHtmlOnCondition`. The start page **is** `pages[0]` when `firstPageIsStartPage` is true, and it is excluded from progress.

### Form.io

`display` on the form JSON selects the renderer: `"form"`, `"wizard"`, or `"pdf"` ([`Form.js` options](https://github.com/formio/formio.js/blob/v5.7.0/src/Form.js)). The wizard does not have a separate page array. Its pages are Panel components in the component tree. Switching a web form to a wizard moves every field into one panel, which becomes page one. To move a field between wizard pages you switch back to web form, move it between panels, and switch again ([form types](https://help.form.io/userguide/forms/form-types)).

The hidden component's schema is `{ type: "hidden", tableView: false, inputType: "hidden" }` ([`Hidden.js`](https://github.com/formio/formio.js/blob/v5.7.0/src/components/hidden/Hidden.js)). Its value is the component's `dataValue`. Which property of `submission.data` that uses: **unverified** (the usual Form.io `key` was not in the files read).

### This module today

A definition is `format`, `title`, optional `description`, and `questions`. Array order is display order. Each snapshot's `id` is a UUID minted by the builder. Answers are an object keyed by that id. Duplicate ids are rejected (`packages/core/src/lib/definition/form-definition.ts`, [ADR-005](../../../docs/adr/0005-form-definition-model.md)). There is no page, welcome, ending, hidden field, or progress field.

## 3. What the respondent goes through

### Navigation

| Product | What "next" means | Back |
|---|---|---|
| Typeform | Next question, or next multi-question page. Auto-advance exists but was not read in detail. Arrows can be hidden (`hide_navigation`). | Arrows, unless hidden. Re-validation: **unverified**. |
| Tally | Next page. Optional auto-jump on multiple choice, dropdown, rating, and linear scale only, and only when the page has one of those ([help](https://tally.so/help/multi-page-forms)). | **Unverified.** |
| Google Forms | Next section. An option can `SUBMIT_FORM`, `RESTART_FORM`, or `goToSectionId` ([API](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms#Option)). | **Unverified.** |
| Fillout | Next page. Auto jump can skip the button ([listed](https://www.fillout.com/help/llms.txt) as [auto jump](https://www.fillout.com/help/auto-jump); that page was not read). | **Unverified.** |
| Formbricks | Next block. A block's button label is optional. `startAt` opens a later block and skips earlier ones ([start-at](https://formbricks.com/docs/surveys/link-surveys/start-at-block)). | A back button, unless `isBackButtonHidden`. |
| SurveyJS | `nextPage()` moves through `visiblePages`. Hidden pages are skipped. `autoAdvanceEnabled` moves on when the page is valid. | `prevPage()` moves back and ignores validation errors. |
| Form.io | `nextPage()` if the current page validates. Breadcrumbs can jump, but not to a future page unless `allowPrevious` is set (the flag's comment says it controls visited tabs). | Previous is on by default. |

SurveyJS is the only one in this set that documents three validation times: before next (the default), on every change, and only on complete. Form.io gates Next and lets Previous through. The others either were not read at that level of detail or only document "required" without saying when it is enforced.

Tally's auto-jump and SurveyJS's auto-advance both change the screen because of an answer, with no extra button. That is the case [WCAG 2.2 success criterion 3.2.2 On Input](https://www.w3.org/WAI/WCAG22/Understanding/on-input.html) is about: changing a control must not change context unless the user was warned first. A warned "answering this moves you on" can pass. An unwarned one fails. Typeform's auto-advance, Fillout's auto jump, and Tally's auto-jump all need that warning if they are used. This module does not auto-advance today.

### Unanswered and hidden questions on other pages

- **Typeform.** Omitted from `answers`. Hidden fields are a separate object, not questions ([webhook](https://developers.typeform.com/developers/webhooks/example-payload/)).
- **Google.** The response map only contains questions that have an `Answer`. There is no hidden-question type in the resource.
- **SurveyJS.** Values of invisible questions stay in `data` until `clearInvisibleValues` removes them (`"onComplete"` by default, `"onHidden"`, `"onHiddenContainer"`, or `"none"`). A hidden page is skipped and is not part of `visiblePages`, which is also what the progress bar counts when the type is `pages`.
- **Formbricks.** Hidden fields are not questions. An element can be hidden by logic; that mechanism is the logic sibling. Prefill can skip a question visually while still submitting its value (`skipPrefilled`).
- **This module.** An optional question with no answer has no key. Unknown keys are refused ([embedding, Answers](../../../docs/embedding.md)). There is no "hidden" state. A question that is not in the version does not exist for that response ([ADR-009](../../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md)).

### Progress

- Typeform's bar is a fill, not "step 2 of 7". With branching it is knowingly wrong, and the help says to disable it ([progress help](https://help.typeform.com/hc/en-us/articles/360051557892-Activate-the-Progress-bar)). The API lets the fill be a percentage or a proportion (questions answered so far). The help article does not describe that switch.
- Tally's flag is only on/off in the schema. How the fraction is computed: **unverified**.
- Fillout's default bar is "how much is done". The stepped bar is 3 to 5 named steps, each referenced from a page, so it is not one step per page ([progress](https://www.fillout.com/help/progress-bar)).
- SurveyJS defaults the bar to off. `pages` uses completed pages. In one-question mode that would lie, so the source forces `questions` instead. `inputPerPage` hides the bar. `requiredQuestions` and `correctQuestions` are the other modes.
- Form.io's wizard speaks the step fraction only for the `StepIndicator` header.

The W3C tutorial asks for the step in the **page title first** ("Step 2 of 4: Shipping Address – …"), then in the `h1`, and optionally a `progress` element or a step list. The `progress` element's OS animation can fail [2.2.2 Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide) if it runs longer than five seconds; they show CSS that stops it. Completed steps should be links, and the current step's data should be saved before following one ([tutorial](https://www.w3.org/WAI/tutorials/forms/multi-page/)). None of the products above document updating `document.title` per step. Form.io is the only one that documents announcing the step to a screen reader.

### Partial responses and abandonment

- Typeform's client autosave and its Partial Submit Points are different. The points create a real response, counted against the plan limit, with status Partial or Completed. Going back and editing updates that partial. A later final submit in the **same** browser session does not count again; a new session does. Points cannot sit inside a multi-question page, after the welcome screen, or at the end ([partial help](https://help.typeform.com/hc/en-us/articles/360052407512-Collect-partial-responses)).
- Google keeps a draft for 30 days in the respondent's own session, then drops it. It is not a response the owner sees. The help tells owners to turn this off for embeds and shared devices ([edit help](https://support.google.com/docs/answer/2839737)).
- Fillout lets the respondent resume on every plan, and lets the owner **see** the partial only on Business and above ([partial](https://www.fillout.com/help/partial-submissions)).
- Formbricks records a partial from the moment the survey is opened, including an open with no answers ([partial docs](https://formbricks.com/docs/surveys/general-features/partial-submissions)).
- SurveyJS does not store a partial. If the host saves, the complete page is where the "saving" UI lives, so `showCompletePage` must stay on (source comment).
- This module stores a response only on a successful submit. There is no autosave, no resume, and no abandoned row ([ADR-002](../../../docs/adr/0002-mvp-product-calls.md)).

### Mobile

Typeform, on mobile, shows an embedded form as a full-screen pop-up with its **own** start screen (form name and a launch button), which hides the form's Welcome Screen until "Full-screen on mobile" is turned off ([Welcome Screen help](https://help.typeform.com/hc/en-us/articles/360052366812-Welcome-Screen)). Partial Submit Points cannot be added in the mobile builder. Other products: **unverified** for this pass.

### Accessibility

The W3C multi-page tutorial's rules, all from [that page](https://www.w3.org/WAI/tutorials/forms/multi-page/):

- Repeat the overall instructions on every page.
- Split on logical groups, not on an arbitrary count.
- Make optional stages recognisable and skippable.
- Do not impose a time limit. If you do, let the user extend or remove it ([2.2.1 Timing Adjustable](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html), cited by the tutorial via the related techniques).
- Put progress in the title, then in the main heading.
- Keep going-back possible, and save the current step before a jump back.

Criteria that bind a paged form even when it is one URL:

- [2.4.2 Page Titled](https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html). For a single-page app, the title should change when the view changes. A form embedded in a host page does not own that title.
- [2.4.3 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html). Moving to the next step is a change of context. Focus has to land somewhere that preserves meaning. SurveyJS does this with `autoFocusFirstQuestion` (default false) and `focusFirstQuestion()` on the new page, which also scrolls the page to the top (source). Form.io announces the step when the header is a step indicator.
- [3.2.2 On Input](https://www.w3.org/WAI/WCAG22/Understanding/on-input.html). Auto-advance on answer is a context change. A button that moves to the next page is an activation, not a setting change, so Next itself is fine.
- [3.2.3 Consistent Navigation](https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html). Repeated navigation (Back, Next) stays in the same relative order. The criterion is written for a set of web pages. A wizard that never changes the URL is one web page; the spirit still applies to Back and Next not swapping places between steps.
- [3.3.1 Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html). A failed Next or Submit has to name the fields in error, in text. Native browser validation is a weak way to do this: the message can be generic, unmagnified, and only the first error is shown. SurveyJS puts `questionErrorLocation` at `top` by default. This module already lists every publish and submit issue; a paged renderer would have to show the current page's issues and move focus to the first, which is what 3.3.1's "user agent native validation" section says browsers do.

[3.3.2 Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html) is the tutorial's other cited criterion: each step still needs its labels. Paging does not remove that.

Formbricks is the only product here that cites a WCAG criterion in the schema. `keepEndingCardOpen` keeps an in-app ending on screen, because an ending that disappears on a timer conflicts with 2.2.1 (comment on that field in `types.ts`).

## 4. Hidden fields and prefill

### Declaration and storage

| Product | Declared as | Arrives as | Stored with the response as | Signed? |
|---|---|---|---|---|
| Typeform | `hidden: ["first_name", "source"]` | URL **hash** | `hidden` object beside `answers`. Names are lower-cased in the published example (`Fran` stored as `fran`) | No. The help treats the value as whatever is in the URL. |
| Tally | `HIDDEN_FIELDS` block, each `{uuid, name}` | Query `?name=Marie&ref=email` | Shown in Submissions. JSON shape **unverified** | No signature described. |
| Google Forms | Not a hidden field. Pre-fill writes ordinary answers into a link | The pre-filled link | Those answers are normal answers if the respondent submits them | No. |
| Fillout | URL parameters registered in form settings | Query `?key=value` | "Stored in hidden fields", and can be mapped to an integration ([URL parameters](https://www.fillout.com/help/url-parameters)) | No signature described. |
| Formbricks | `hiddenFields.fieldIds`, or an embedded-data row whose source is "Passed in" | Query, or `formbricks.setEmbeddedData`, or the older `track(..., { hiddenFields })` | Shown on the response like other fields. A passed-in field's **key** is the query name and cannot be renamed later; the display name can ([docs](https://formbricks.com/docs/surveys/general-features/hidden-fields)) | No. |
| SurveyJS | Not a hidden field. Host sets `survey.data` before or during the run | Whatever the host assigns | The same `data` object as typed answers | No. It is client memory. |
| Form.io | A hidden component in the form JSON | Default value, logic, or script. URL parsing: **unverified** | `dataValue` on that component | No. |
| This module | External references are not fields. They are `refs` claims on the host-signed token | The token, never the body | Stored with the response, atomically, from that token ([embedding, The reference guarantee](../../../docs/embedding.md)) | Yes. HS256 or the host JWKS. |

### Tamper and privacy

Nobody in this set signs the prefilled value.

Typeform's help is the blunt version. The values sit in the URL, so they land in browser history, the address bar, server logs, proxy logs, and any analytics tool that records the URL. They tell you not to put passwords, tokens, card numbers, government ids, or special-category data there. Their suggested replacement is a non-sensitive id, with the real lookup done in your own system. They also warn that putting a name or email in the URL and then into Google Analytics breaks Google's terms unless those parameters are excluded. Renaming a parameter **deletes** responses already collected under the old name. Turning the parameters off hides the columns; it does not delete them ([URL parameters help](https://help.typeform.com/hc/en-us/articles/360052676612-Using-URL-parameters-formerly-Hidden-Fields)).

Tally uses the query string, which is the part servers and proxies log most reliably. The help does not add a privacy warning of its own in the page that was read. Same for Fillout: the value is a query parameter, and the prefill article says the respondent can change a default.

Google's pre-fill is worse for secrecy in one way and better in another. The values are ordinary answers in a shareable link, so anyone with the link sees and can edit them. They are not a side channel beside the questions. There is no lock in the article.

Formbricks refuses to let a hidden field steal a reserved query name (`userId`, `source`, `suid`, `preview`, `startAt`, `skipPrefilled`, and others) or an auto-captured name (`ipAddress`, UTM names, and others). That stops a hidden field from shadowing the product's own parameters. It does not stop the respondent from setting `?plan=enterprise` to whatever they like. An older field whose name only differs by case from a reserved word keeps working, but logs a console warning. Keys are immutable after creation; deleting one and adding it again is a new field, and a grandfathered illegal name cannot be re-added ([hidden fields](https://formbricks.com/docs/surveys/general-features/hidden-fields)).

Form.io's hidden input is just a value in the submission. The respondent, or any script on the page, can change it before submit. `skipInEmail` keeps it out of the default email, which is not a trust control.

### Against this module's host-signed references

A response's external references are the token's `refs`, written at submit, and the submit body is not allowed to carry `externalRefs` ([ADR-002](../../../docs/adr/0002-mvp-product-calls.md) as amended, [embedding](../../../docs/embedding.md)). The token is bound to one form when it carries `refs`, and it should live for minutes. That is the opposite of a URL parameter: the respondent cannot mint it, and the module never trusts the browser for it.

A URL-prefilled **answer** is a different thing. It is still an answer, the respondent can change it unless the product locks it, and it should be stored under the question id like any other answer. Using a URL parameter as a stand-in for "which project this response belongs to" would throw away the guarantee ADR-012 exists to give. Typeform's own advice — put a harmless id in the URL, look up the rest on the server — is the same split this module already has, except the lookup result rides in the signed token rather than in a hidden field.

None of these products document a signed or HMAC'd prefill. If a later design wants a prefilled answer the respondent must not change, that lock is a new decision. Copying their URL parameter does not provide it.

## 5. What this means for Formidabile

Only consequences that follow from the sources above and from the ADRs.

### Pages do not change who a question is

Answers are keyed by question id, and the array order is only display order (`form-definition.ts`: "Array order is display order."). [ADR-009](../../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md) combines on that id, never on position or label. Moving a question from one page to another, or reordering pages, is the same kind of change as reordering the list today: the snapshot's position changes, the id does not, and old responses stay readable. A page index must not become part of the answer key. Google, Typeform, SurveyJS, and Formbricks all key answers by question id, field id, or question name, not by "page 2, item 3".

Formbricks freezes the question id at activation because stored responses point at it. This module already does the stronger version: the id is fixed for the life of the question, and a type change mints a new one ([ADR-005](../../../docs/adr/0005-form-definition-model.md)).

### What a page-aware definition does to ordered snapshots

Two shapes show up in the sources:

1. **Markers in one list.** Tally's `PAGE_BREAK` and Google's `pageBreakItem` sit in the same ordered list as the questions. The mental model stays "ordered snapshots", plus break markers. Welcome and thank-you are either a flag on a break (Tally `isThankYouPage`) or a separate object (Typeform).
2. **Pages as containers.** SurveyJS `pages[].elements`, Formbricks blocks, Form.io panels, Fillout pages. Display order becomes page order, then order inside the page. Flattening that tree gives back the ordered list ADR-005 stores.

Either shape can freeze inside a form version. The current document is `format: 1` and a flat `questions` array, and published versions are never migrated ([ADR-005](../../../docs/adr/0005-form-definition-model.md)). A tree is a new format. Readers would have to accept format 1 forever and format 2 as the paged one. Putting break markers into the same `questions` array would also be a new format, because those items are not question snapshots and the array is a `discriminatedUnion` of question types today.

A display-only paging mode (SurveyJS `questionsOnPageMode`, or "show one question at a time" with no stored pages) does not touch the definition. It cannot express a designed section title, a review step, or "these three questions share a page".

Block or page ids, if they exist, are not question ids. Formbricks keeps them apart (cuid for the block, caller string for the element) and `startAt` takes a question id, then resolves the block. Analytics that counted "dropped off on page 2" would be counting a position, which ADR-009 refuses to treat as identity. Typeform already makes this concrete: a multi-question page has one drop-off metric for the page, and the questions inside it have none ([multi-question help](https://help.typeform.com/hc/en-us/articles/360051998891-How-to-add-multiple-questions-to-a-form-page)).

### No incomplete response on the server

[ADR-002](../../../docs/adr/0002-mvp-product-calls.md): a response exists only after a successful submit. There is no autosave and no abandoned row. A multi-step renderer therefore holds every answer in memory until the last step. A reload, a closed tab, or a host that remounts the element (`form-id` or `response-id` changes start over and drop on-screen answers, [embedding](../../../docs/embedding.md)) throws the attempt away. That matches the ADR. It is the opposite of Google (30-day client draft), Fillout (server partial, resume on every plan), Formbricks (partial from first open), and Typeform's Partial Submit Points (a real, billable response).

A review step fits the ADR if it is only a client-side summary before the same single POST. SurveyJS's preview page works that way: it is a mode, not a submission. The moment a step is saved on the server, the module needs the submission status ADR-002 deliberately left out.

`VersionSuperseded` already clears the form and loads the new version with empty answers ([embedding](../../../docs/embedding.md), [ADR-002](../../../docs/adr/0002-mvp-product-calls.md)). Paging does not change that. Answers were never on the server, so there is nothing to map onto the new version. Carrying them across in the browser would be the client guessing, which the ADR forbids the server to do.

### Embedding

The renderer is an open shadow root under a strict CSP: no inline scripts, no `unsafe-eval`, styles via a constructable stylesheet ([embedding](../../../docs/embedding.md)). Consequences of paging inside that element, from the sources rather than from invention:

- **Focus.** The next step has to move focus on purpose ([2.4.3](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)). SurveyJS scrolls the page to the top and focuses the first question. Inside a shadow root, that scroll is either the host window or a scroller in the shadow. The element does not document either. Focusing a control in the shadow does not by itself scroll the host's heading into view.
- **Title.** [2.4.2](https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html) wants the document title to change when a single-page view changes. The element does not own `document.title`. Setting it would rename the host page. Not setting it means a screen-reader user who reads the title still hears the host's title. The W3C tutorial's "Step 2 of 4" in the title is the host's problem unless the element is the whole page.
- **History and the Back button.** The products that are full pages (Typeform's hosted form, Google's sections, Tally's hosted form) get the browser's Back key for free only if each step is a navigation. An embedded wizard that does not push a history entry will see the browser Back key leave the host page, discarding the in-memory answers. Pushing a history entry from inside the element couples the form to the host's router. The embedding contract does not mention `history` or a hash. Typeform puts hidden fields in the hash (`#first_name=…`); using the hash for the step would collide with any host that already uses it, and would put step state in a place proxies and analytics can see.
- **CSP.** Paging that is just DOM in the shadow stays inside the existing policy. A redirect that assigns `window.top.location` is a navigation, which CSP does not block by default, but it is exactly the host-owned action below.
- **Endings and redirects.** Typeform can send the parent frame somewhere (`data-tf-redirect-target="_self"` is an explicit opt-in; the default for an embed is the frame). Formbricks and Fillout redirect as the ending. This module's host "is responsible for determining when a form should be displayed" and what a completed response does to its workflow ([ADR-001](../../../docs/adr/0001-modular-versioned-form-management.md) §3.2, restated in [embedding](../../../docs/embedding.md)). The element reports `submitted` with `{ responseId }` and stops. A redirect URL stored in the definition would navigate the host out from under itself, or would be ignored. The ending **copy** can live in the version, the way the title already does, so a historical response can show the thank-you text that version used. The navigation cannot, unless the host opts in.

Multiple endings in Typeform, Fillout, and Formbricks are chosen by logic. [ADR-002](../../../docs/adr/0002-mvp-product-calls.md) excludes conditional visibility, and the logic sibling owns branching. A second ending with no rule to choose it has no respondent-facing behaviour. One ending, or none, is the only variant that does not depend on that work.

### Open questions for the owner

1. Should paging be stored (a new definition format) or be a renderer mode over the flat list? A mode cannot name a section or pin three questions to one screen.
2. If stored: break markers in the one list, or a pages array? Markers keep "ordered snapshots" obvious. A pages array matches SurveyJS and Formbricks and needs a flatten rule for the answer object.
3. Do pages have ids? If yes, they must not be answer keys, and dropping a page must not look like deleting a question.
4. Is the thank-you text part of the published version (so it freezes with the questions) or host UI outside the element?
5. One ending only, until conditional logic exists?
6. Confirm that URL prefill, if it ever exists, is an editable answer under the question id, and that "which host record" stays in the signed token. Nothing read here signs a prefill.
7. Is losing an in-progress attempt on reload still acceptable once a form is several screens? ADR-002 says yes. Google turns autosave off specifically for embedded forms, which is the same call for a different reason (shared devices).
8. May the element set `document.title`, call `history.pushState`, or write the step into the hash? The embedding contract is silent, and each one leaks into the host.
9. On Next, does focus move to the first field of the new step, and does the host page scroll? SurveyJS does both. The shadow root makes "scroll" a choice.
10. A review step before the single submit: yes or no? It does not need a server change. It does need a place to show a question that failed validation on an earlier step.

## 6. Could not verify

- **Typeform.** The developer URL-parameters guide (`developers.typeform.com/developers/create/url-parameters/`) was fetched and returned navigation, not the article body. Hash behaviour is from the Help Center article, which did load. No review-before-submit step was found. No question-order or page-order randomise was found (choice randomise is real). Whether Next blocks on an invalid field was not stated in the articles read. Where `autosave_progress` writes (local storage, cookie, memory) is not stated beyond "on the client side". Whether hidden-field values are lower-cased in general, or only in that example, is not stated. The create API allows `welcome_screens` as an array; the help says one welcome screen. Which one wins was not tested.
- **Tally.** Back navigation. Whether Next is blocked until the page is valid. The submission JSON, including where a hidden field is stored (the submissions endpoint did not load). Whether more than one `isThankYouPage` break is allowed to work. Whether `saveForLater` is a server resume or a client prompt. The pre-populate help page was not read past the API's `defaultAnswer`.
- **Google Forms.** Progress bar. The help URL `support.google.com/docs/answer/6357590` 404'd, and `FormSettings` has no progress field. Whether Next on a section validates before leaving. Whether the respondent can go back. Whether the confirmation message can be a redirect. No hidden-field feature was found in the Form resource; a dedicated help search was not completed (the search engine challenged the client).
- **Jotform.** Card versus classic layout (help article 422 returned 404). Page breaks, progress, back, review, hidden fields, URL prefill, partial responses, per-page validation, and randomise. The API pages that did load only show a flat question map with `order` and a single `thankurl` property.
- **Fillout.** No form JSON schema. Back navigation. Per-page validation. Respondent-facing page titles. Randomise. Whether URL parameters are signed (they are not described as signed; the absence is the finding). The cover-page, section-collapse, and auto-jump articles were identified from the index and not read.
- **Formbricks.** A progress indicator (no such field in the `ZSurveyBase` slice that was read). A review page (not in the schema). The response JSON key for a hidden-field value (the docs say it appears on the response; the response schema was not read). Whether the renderer refuses to leave a block that has an empty required element. The exact file path `packages/types/surveys/types.ts` is the layout of the commit that was fetched; confirm the path if the repo moves that file.
- **SurveyJS.** The git tag of the fetched `survey.ts` was not retained. Defaults cited from it (`checkErrorsMode` `onNextPage`, `showPrevButton` true, `showProgressBar` false, `questionOrder` `initial`, `clearInvisibleValues` `onComplete`, `questionsOnPageMode` `standard`, `showCompletePage` true) match the public API reference as fetched the same day. Page-order randomise was not found. There is no hidden-field type in the model that was read.
- **Form.io.** Thank-you and ending screens, multiple redirects, URL prefill, and a progress percentage. Whether `submission.data` is keyed by component `key` (not in the three files read). Draft or partial submissions on the Form.io platform. Nested wizard behaviour beyond the `subWizards` hook.
- **W3C.** The tutorial and the five Understanding documents listed above were read. 3.2.1 On Focus, 3.3.3 Error Suggestion, and 2.4.6 Headings and Labels were not read for this note. 3.3.1's understanding page discusses 3.3.3 only in passing.
- **This module.** No code was run. The definition shape is from `form-definition.ts` and the ADRs as read in the repo.
