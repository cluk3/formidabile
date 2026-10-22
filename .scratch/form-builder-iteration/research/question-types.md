# Question types beyond Formidabile's seven

Researched 2026-10-22 against Formidabile `packages/core` (definition format 1), Typeform Help Center and the Create and Responses API docs (no product version on those pages), Tally Help and developer docs (API date-versioned; no single current version number on the versioning page), Google Docs Editors Help (no product version), Jotform Help "Quick Overview of Form Elements" (page last update 16 January 2025), Fillout Help and REST API docs (no product version), Formbricks `main` at `b787dc04c35de1514a5841db483003aef1d72b92` (committed 2026-10-22), SurveyJS Form Library `v3.2.2` (published 2026-10-20), and Form.io `formio.js` `main` at `90732a2192f3cd909574b4bf5292a1bbaa3a0717` (committed 2026-10-14).

## Sources

Every claim is cited to one of these. "Not in the inventory" means the official list below does not name it. It does not mean a paid widget, a custom question class, or an unlisted enterprise component was ruled out. Those cases are marked unverified.

- **[FB]** Formidabile as implemented. Question snapshots are a discriminated union of `text`, `email`, `number`, `date`, `single_choice`, `multiple_choice` and `boolean` ([form-definition.ts](../../packages/core/lib/definition/form-definition.ts)). Answers are an object keyed by question identity whose values are untagged `string | number | boolean | string[]` ([answers.ts](../../packages/core/lib/answers/answers.ts)). A question identity keeps one type for life ([ADR-005](../../../docs/adr/0005-form-definition-model.md)). Dropdown versus radio, and single-line versus multi-line, are display settings ([ADR-002](../../../docs/adr/0002-mvp-product-calls.md)). A `number` whose range changes still combines ([ADR-009](../../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md)). The glossary defines a question type by answer representation and validation ([GLOSSARY.md](../../../GLOSSARY.md)).
- **[CSP]** The renderer spike's host policy was `Content-Security-Policy: default-src 'self'; script-src 'self'` ([renderer-csp-styles-spike.md](../../form-builder-mvp/research/renderer-csp-styles-spike.md)).
- **[TF-q]** Typeform Help, [Question types](https://help.typeform.com/hc/en-us/articles/360051789692-Question-types), fetched 2026-10-22. The page presents this as the question menu.
- **[TF-r]** Typeform Developers, [Responses API JSON response explanation](https://www.typeform.com/developers/responses/JSON-response-explanation/), fetched 2026-10-22.
- **[TF-c]** Typeform Developers, [Create form](https://www.typeform.com/developers/create/reference/create-form/), fetched 2026-10-22. The field `type` enum read from that page was: `calendly`, `checkbox`, `contact_info`, `date`, `dropdown`, `email`, `file_upload`, `google_calendar`, `group`, `legal`, `long_text`, `matrix`, `multi_format`, `multiple_choice`, `nps`, `number`, `opinion_scale`, `payment`, `phone_number`, `picture_choice`, `ranking`, `rating`, `short_text`, `signature`, `statement`, `website`, `yes_no`.
- **[TA]** Tally Help, [Input blocks](https://tally.so/help/input-blocks), fetched 2026-10-22.
- **[TA-b]** Tally Developers, blocks index in [llms.txt](https://developers.tally.so/llms.txt), fetched 2026-10-22. The linked block pages (`matrix`, `file-upload`, `signature`, `rating`, `payment`, `calculated-fields`, `captcha`, `hidden-fields`, `respondent-country`) returned a title and no schema when fetched as markdown the same day.
- **[TA-v]** Tally Developers, [Versioning](https://developers.tally.so/api-reference/versioning.md). Keys are date-versioned (example `2025-01-15`). No response body was read from the submissions endpoint.
- **[GF]** Google Docs Editors Help, [Choose a type of question for your form](https://support.google.com/docs/answer/7322334?hl=en), fetched 2026-10-22. The English page lists the question menu. No response schema is on that page.
- **[JF]** Jotform Help, [Quick Overview of Form Elements](https://www.jotform.com/help/46-quick-overview-of-form-fields/), last update 16 January 2025, fetched 2026-10-22. The page calls itself a complete list of form fields and then points at a separate Widgets tab, which this page does not enumerate. No plan tier and no answer JSON are on this page.
- **[FO]** Fillout Help, [Field types](https://www.fillout.com/help/question-types), fetched 2026-10-22. The page says some types (marked with a symbol that did not survive the text fetch) require Starter, Pro, Business or Enterprise. Which rows were marked is unverified.
- **[FO-a]** Fillout REST API, [Get form metadata](https://www.fillout.com/help/api-reference/get-form-metadata) and [Get all submissions](https://www.fillout.com/help/api-reference/get-all-submissions), fetched 2026-10-22. Question `value` is typed `<unknown>`. Scheduling and payment objects are specified. The metadata example question type is the string `"Address"`.
- **[BR-e]** Formbricks `packages/types/surveys/constants.ts` and `elements.ts` at [`b787dc04`](https://github.com/formbricks/formbricks/blob/b787dc04c35de1514a5841db483003aef1d72b92/packages/types/surveys/constants.ts#L2-L19). Element schemas: [elements.ts](https://github.com/formbricks/formbricks/blob/b787dc04c35de1514a5841db483003aef1d72b92/packages/types/surveys/elements.ts).
- **[BR-r]** Formbricks `packages/types/responses.ts` at the same commit, [`ZResponseDataValue`](https://github.com/formbricks/formbricks/blob/b787dc04c35de1514a5841db483003aef1d72b92/packages/types/responses.ts#L7-L44). The per-element writer that picks an arm of that union was not read.
- **[SJ]** SurveyJS `docs/llms/survey-json-authoring.md` at [`v3.2.2`](https://github.com/surveyjs/survey-library/blob/v3.2.2/docs/llms/survey-json-authoring.md). Samples in that file are question JSON, not response JSON, except where noted.
- **[SJ-f]** SurveyJS `packages/survey-core/src/question_file.ts` at [`v3.2.2`](https://github.com/surveyjs/survey-library/blob/v3.2.2/packages/survey-core/src/question_file.ts).
- **[IO-s]** Form.io `formio.js` `src/components/` at [`90732a2`](https://github.com/formio/formio.js/tree/90732a2192f3cd909574b4bf5292a1bbaa3a0717/src/components). Directory names read 2026-10-22: `address`, `button`, `checkbox`, `columns`, `container`, `content`, `currency`, `datagrid`, `datamap`, `datetime`, `day`, `editgrid`, `email`, `fieldset`, `file`, `form`, `hidden`, `html`, `number`, `panel`, `password`, `phonenumber`, `radio`, `recaptcha`, `select`, `selectboxes`, `signature`, `survey`, `table`, `tabs`, `tags`, `textarea`, `textfield`, `time`, `url`, `well`. This is the open-source renderer. Enterprise components outside this tree were not listed.
- **[IO-d]** Form.io Help, [Layout components](https://help.form.io/form-building/layout-components), [Data components](https://help.form.io/form-building/data-components), [Submissions](https://help.form.io/form-building/submissions), fetched 2026-10-22.
- **[IO-c]** Form.io `Signature.js` and `File.js` at the same commit: [Signature.js L236](https://github.com/formio/formio.js/blob/90732a2192f3cd909574b4bf5292a1bbaa3a0717/src/components/signature/Signature.js#L236), [File.js L738-L746 and L1232-L1238](https://github.com/formio/formio.js/blob/90732a2192f3cd909574b4bf5292a1bbaa3a0717/src/components/file/File.js#L738-L746).

## Summary

Formidabile's seven types already cover what most of these products call short text, long text, email, number, date, single choice, dropdown, checkboxes, yes/no and a consent checkbox. The glossary puts dropdown and long text on the existing types, and the products that publish an answer schema agree: Typeform stores `short_text`, `long_text` and `dropdown` as text, and `yes_no` and `legal` as booleans ([TF-r]).

What they ship beyond that, as a stored answer, falls into three groups.

The answer is still a string, number, boolean or list of option values, with tighter validation or a different control. Phone, URL, time, rating, NPS, opinion scale, CSAT, CES, a single slider, picture choice, and a currency amount whose code is configuration rather than data are in this group. Under the glossary they are a display setting or a validation constraint on `text`, `number`, `date`, `single_choice`, `multiple_choice` or `boolean`, not a new type. Email is already the precedent for "same JSON type, own validation": phone and URL match that precedent more than they match plain text.

The answer is a shape `AnyAnswers` cannot hold. Ranking (order matters), matrix (one value per row), file upload, signature, address, contact info, date range, range slider, payment, scheduling and a repeating row set are in this group. They are new question types. Several products store payment, scheduling, hidden fields and scores beside the answer map rather than inside it ([TF-r], [FO-a]).

The control collects nothing to analyse. Welcome and end screens, statements, images, video embeds, dividers, page breaks and HTML blocks are layout or content. CAPTCHA, hidden fields, calculated values and auto-captured country are not respondent answers; the products that document a payload keep them off the answer list or in a side object.

Plan gates that are actually written down: Typeform File Upload and Payment are "available on our paid plans", with no tier named ([TF-q]). Tally calls hidden fields free for every user ([TA]). Fillout says some of its field types require a paid plan, but the fetched page did not show which ones ([FO]). Nobody else's inventory states a tier.

## 1. What each product ships

"Yes" means the inventory names it as its own block, field, element or question class. "Display" means the product has the control, but as a setting or a shared type rather than its own class. "No" means it is absent from that inventory. "Paid" means the page says paid and does not name a tier. "Unverified" means the page points at widgets or a marker that was not readable.

| Normalised type | Typeform | Tally | Google Forms | Jotform | Fillout | Formbricks | SurveyJS | Form.io |
|---|---|---|---|---|---|---|---|---|
| Text, one line | Yes, Short Text [TF-q] | Yes, Short answer [TA] | Yes, Short answer [GF] | Yes, Short Text [JF] | Yes, Short answer [FO] | Yes, `openText` with `longAnswer` unset [BR-e] | Yes, `text` [SJ] | Yes, `textfield` [IO-s] |
| Text, several lines | Yes, Long Text [TF-q] | Yes, Long answer [TA] | Yes, Paragraph [GF] | Yes, Long Text [JF] | Yes, Long answer [FO] | Same element, `longAnswer` [BR-e] | Yes, `comment` [SJ] | Yes, `textarea` [IO-s] |
| Email | Yes [TF-q] | Yes [TA] | No [GF] | Yes [JF] | Yes, Email input [FO] | `openText` `inputType: "email"` [BR-e] | `text` `inputType: "email"` [SJ] | Yes, `email` [IO-s] |
| Number | Yes, positive integers only [TF-q] | Yes [TA] | No [GF] | Yes, plus Spinner [JF] | Yes [FO] | `openText` `inputType: "number"` [BR-e] | `text` `inputType: "number"` [SJ] | Yes, `number` [IO-s] |
| Date | Yes [TF-q] | Yes [TA] | Yes [GF] | Yes, Date Picker [JF] | Yes, Date picker [FO] | Yes, `date` [BR-e] | `text` `inputType: "date"` [SJ] | Yes, `datetime` and `day` [IO-s] |
| Single choice | Yes, Multiple Choice, one selection [TF-q] | Yes, Multiple choice, one answer by default [TA] | Yes [GF] | Yes, Single Choice [JF] | Yes [FO] | `multipleChoiceSingle` [BR-e] | Yes, `radiogroup` [SJ] | Yes, `radio` [IO-s] |
| Multiple choice | Yes, Multiple Choice, multiple selections [TF-q] | Yes, Checkbox, and the multiple-choice block's multiple-answers setting [TA] | Yes, Checkboxes [GF] | Yes [JF] | Yes, Checkboxes and Multiselect [FO] | `multipleChoiceMulti` [BR-e] | Yes, `checkbox` [SJ] | Yes, `selectboxes` [IO-s] |
| Boolean / yes-no | Yes, Yes/No [TF-q] | No separate block [TA] | No [GF] | No core field [JF] | Yes, Switch and Checkbox [FO] | No [BR-e] | Yes, `boolean` [SJ] | Yes, `checkbox` [IO-s] |
| Dropdown | Yes, own type [TF-q][TF-c] | Yes, own block [TA] | Yes, own type [GF] | Yes, own field [JF] | Yes, own field [FO] | Display `list` or `dropdown` on either multiple-choice element [BR-e] | Yes, `dropdown` [SJ] | Yes, `select` [IO-s] |
| Multi-select dropdown | No [TF-q][TF-c] | Yes, Multi-select [TA] | No [GF] | Unverified (widgets) [JF] | Yes, Multiselect [FO] | `multipleChoiceMulti` can use `displayType: "dropdown"` [BR-e] | Yes, `tagbox` [SJ] | `select` with multiple is not separately named in the directory [IO-s] |
| Picture choice | Yes, Picture Choice [TF-q] | Images are a checkbox setting, not a block [TA] | No [GF] | Unverified (widgets) [JF] | Yes [FO] | Yes, `pictureSelection` [BR-e] | Yes, `imagepicker` [SJ] | No [IO-s] |
| Rating (stars, hearts, emoji) | Yes, Rating [TF-q] | Yes, stars, count configurable [TA] | Yes, star, heart or thumbs, 3 to 10 [GF] | Yes, Star Rating [JF] | Yes, Star Rating [FO] | Yes, `rating`, scale `number`, `smiley` or `star` [BR-e] | Yes, `rating`, `rateType` `labels`, `stars` or `smileys` [SJ] | No [IO-s] |
| NPS | Yes [TF-q][TF-c] | Yes [TA] | No [GF] | No core field [JF] | No row in the field table [FO] | Yes, `nps` [BR-e] | No built-in class [SJ] | No [IO-s] |
| Opinion / linear scale | Yes, Opinion Scale [TF-q] | Yes, Linear scale [TA] | Yes, Linear scale, start 0 or 1, end 2 to 10 [GF] | Yes, Scale Rating [JF] | Yes, Opinion scale [FO] | The `rating` element covers a numeric scale [BR-e] | `rating` with `rateType: "labels"` [SJ] | No [IO-s] |
| CSAT | No [TF-q][TF-c] | Yes, 1–5 [TA] | No [GF] | No core field [JF] | No [FO] | Yes, `csat`, range fixed at 5 [BR-e] | No [SJ] | No [IO-s] |
| CES | No [TF-q][TF-c] | No [TA] | No [GF] | No [JF] | No [FO] | Yes, `ces`, range 5 or 7 [BR-e] | No [SJ] | No [IO-s] |
| Ranking | Yes [TF-q] | Yes [TA] | No [GF] | Unverified (widgets) [JF] | Yes [FO] | Yes, `ranking`, 2 to 25 choices [BR-e] | Yes, `ranking` [SJ] | No [IO-s] |
| Matrix, one choice per row | Yes, Matrix [TF-q] | Yes, Matrix [TA] | Yes, Multiple choice grid [GF] | Input Table is a text grid, not this [JF] | Yes, Choice matrix [FO] | Yes, `matrix` [BR-e] | Yes, `matrix` with `cellType: "radio"` [SJ] | Yes, `survey` component [IO-s] |
| Matrix, several choices per row | Unverified whether Matrix's multiple selection is in the help page [TF-q] | Unverified; the help page does not say [TA] | Yes, Checkbox grid [GF] | No [JF] | Unverified from the field table [FO] | The element schema has no multi flag [BR-e] | Yes, `matrix` `cellType: "checkbox"` [SJ] | Unverified; `survey` source was not read [IO-s] |
| Likert | "Create Likert Scale questions with" Matrix [TF-q] | "Can be used to create a Likert scale" on Matrix [TA] | Described as rating a category, not named Likert [GF] | No [JF] | No separate row [FO] | No [BR-e] | No separate class [SJ] | No [IO-s] |
| Slider, one value | No [TF-q][TF-c] | No [TA] | No [GF] | Unverified (widgets) [JF] | Yes, Slider [FO] | No [BR-e] | Yes, `slider` `sliderType: "single"` [SJ] | No [IO-s] |
| Slider, a range | No [TF-c] | No [TA] | No [GF] | Unverified [JF] | Unverified [FO] | No [BR-e] | Yes, `sliderType: "range"` [SJ] | No [IO-s] |
| File upload | Yes, paid plans; also Google Drive [TF-q] | Yes [TA] | Yes, with account and admin constraints [GF] | Yes [JF] | Yes, File uploader [FO] | Yes, `fileUpload` [BR-e] | Yes, `file` [SJ] | Yes, `file` [IO-s] |
| Signature | Yes [TF-q] | Yes [TA] | No [GF] | Yes [JF] | Yes [FO] | No [BR-e] | Yes, `signaturepad` [SJ] | Yes, `signature` [IO-s] |
| Phone | Yes [TF-q] | Yes [TA] | No [GF] | Yes [JF] | Yes [FO] | `openText` `inputType: "phone"` [BR-e] | `text` `inputType: "tel"` [SJ] | Yes, `phonenumber` [IO-s] |
| URL | Yes, Website [TF-q] | Yes, Link [TA] | No [GF] | No core field [JF] | Yes, URL [FO] | `openText` `inputType: "url"` [BR-e] | `text` `inputType: "url"` [SJ] | Yes, `url` [IO-s] |
| Address | Yes [TF-q] | No block [TA] | No [GF] | Yes [JF] | Yes [FO] | Yes, six toggled subfields [BR-e] | No class; `autocomplete` tokens include street-address [SJ] | Yes, `address` [IO-s] |
| Contact info / full name | Yes, Contact Info [TF-q][TF-c] | No composite block [TA] | No [GF] | Yes, Full Name [JF] | No composite row [FO] | Yes, five toggled subfields [BR-e] | Yes, `multipletext` [SJ] | No composite; fields sit in a `container` [IO-d] |
| Time only | No [TF-c] | Yes, 24-hour [TA] | Yes, time or a duration [GF] | Yes, Time [JF] | Yes, Time picker [FO] | No [BR-e] | `text` `inputType: "time"` [SJ] | Yes, `time` [IO-s] |
| Date and time | Date answers are midnight UTC, and the help page does not offer a time [TF-r][TF-q] | No [TA] | Yes, "include time" on Date [GF] | Yes, optional time on Date Picker [JF] | Yes, Date time picker [FO] | No [BR-e] | `text` `inputType: "datetime-local"` [SJ] | Yes, `datetime` [IO-s] |
| Date range | No [TF-c] | Date block can "set specific dates or date ranges"; whether the answer is a range is unverified [TA] | No [GF] | No [JF] | Yes, Date range [FO] | No [BR-e] | No [SJ] | No [IO-s] |
| Consent checkbox | Yes, Legal and Checkbox [TF-q] | Checkbox "or a consent checkbox" [TA] | No [GF] | No core field [JF] | Yes, Checkbox, "terms of service" [FO] | Yes, `consent` [BR-e] | `boolean` with `displayMode: "checkbox"` [SJ] | A single `checkbox` [IO-s] |
| Hidden field | Yes, `hidden` on the response, not a question type [TF-r] | Yes, and free for every user [TA] | No [GF] | Unverified [JF] | URL parameters, a side list [FO-a] | No element [BR-e] | No question class [SJ] | Yes, `hidden`, `input: true` [IO-d] |
| Calculated value | Yes, `calculated` and `variables` on the response [TF-r] | Yes [TA] | No [GF] | Unverified [JF] | Side list, type `number` [FO-a] | No element [BR-e] | Yes, `expression`, and survey `calculatedValues` [SJ] | Done with `hidden` plus logic [IO-d] |
| Payment | Yes, paid plans, Stripe or PayPal [TF-q] | Yes, Stripe [TA] | No [GF] | Yes, Product List plus a Payments tab [JF] | Side list, not a field-table row [FO-a] | No [BR-e] | No [SJ] | No [IO-s] |
| Scheduling | Yes, Scheduler, Google Calendar or Calendly [TF-q] | No [TA] | No [GF] | Yes, Appointment [JF] | Side list [FO-a] | Yes, `cal` [BR-e] | No [SJ] | No [IO-s] |
| Country | No own type [TF-c] | No; Respondent country is auto-captured [TA-b] | No [GF] | Inside Address, not its own field [JF] | No [FO] | A subfield of `address` [BR-e] | No [SJ] | Inside `address` [IO-s] |
| Currency amount | No [TF-c] | No [TA] | No [GF] | No core field; payment products are separate [JF] | Yes, Currency [FO] | No [BR-e] | `text` `maskType: "currency"` [SJ] | Yes, `currency` [IO-s] |
| CAPTCHA | No [TF-c] | Yes, reCAPTCHA [TA] | No [GF] | Yes, Captcha, or Google reCAPTCHA [JF] | Yes [FO] | No [BR-e] | No [SJ] | Yes, `recaptcha` [IO-s] |
| Video / audio answer | Yes, Video and Audio, answer type `multi_format` [TF-q][TF-r] | Embed plays media; it does not collect a recording [TA] | No [GF] | No [JF] | Yes, Voice recording [FO] | No [BR-e] | `file` `sourceType` includes `camera` [SJ] | No [IO-s] |
| Rich text answer | No [TF-c] | No [TA] | No [GF] | Paragraph is display-only rich text [JF] | Yes, Rich text answer [FO] | No [BR-e] | No [SJ] | No [IO-s] |
| Password | No [TF-c] | No [TA] | No [GF] | No [JF] | Yes [FO] | No [BR-e] | `text` `inputType: "password"` [SJ] | Yes, `password` [IO-s] |
| Color | No [TF-c] | No [TA] | No [GF] | No [JF] | Yes, Color picker [FO] | No [BR-e] | `text` `inputType: "color"` [SJ] | No [IO-s] |
| Location | No [TF-c] | No [TA] | No [GF] | Unverified [JF] | Yes, Location coordinates [FO] | No [BR-e] | No [SJ] | No [IO-s] |
| Lookup / record picker | No [TF-c] | No [TA] | No [GF] | Unverified [JF] | Yes, Record picker and Submission picker [FO] | No [BR-e] | `dropdown` `choicesByUrl` [SJ] | `select` can load external values; the source of that was not read [IO-s] |
| Repeating rows | Question Group does not repeat [TF-q] | No [TA] | No [GF] | Unverified [JF] | Yes, Table [FO] | No [BR-e] | Yes, `matrixdynamic` and `paneldynamic` [SJ] | Yes, `datagrid` and `editgrid` [IO-d] |
| Tags, free text | No [TF-c] | No [TA] | No [GF] | No [JF] | No [FO] | No [BR-e] | `dropdown` `allowCustomChoices` and `tagbox` [SJ] | Yes, `tags` [IO-s] |
| Statement, welcome, thank-you | Yes, Statement, Welcome Screen, End Screen [TF-q] | Title, headings [TA-b] | No question; sections exist only as a destination of branching [GF] | Header, Paragraph [JF] | Text, Heading, Paragraph, Banner [FO] | `cta` is a button, not a statement [BR-e] | `html`, `image`, and the survey complete page [SJ] | `content`, `htmlelement` [IO-d] |
| Page break, divider, collapse | Question Group [TF-q] | Divider, Page break [TA-b] | Not in the question menu [GF] | Divider, Page Break, Section Collapse [JF] | Divider, Section collapse [FO] | No [BR-e] | Pages, and `panel` [SJ] | `panel`, `fieldset`, `well`, `columns`, `tabs` [IO-d] |
| Clarify with AI / FAQ with AI | Named in the help menu; absent from the Create API enum [TF-q][TF-c] | No [TA] | No [GF] | No [JF] | No [FO] | No [BR-e] | No [SJ] | No [IO-s] |

## 2. Types that are not in Formidabile's seven

Each verdict uses the glossary: a question type is fixed by the answer representation and the validation. A control that stores the same value is a display setting. Something with no respondent answer is not a question.

### Rating

A star, heart, thumbs or emoji control bound to a small integer. Typeform stores `rating` as `number` (example `3`) ([TF-r]). Google Forms limits it to a whole number from 3 to 10 and lets the icon be a star, a heart or a thumbs up ([GF]). Formbricks' `scale` is `number`, `smiley` or `star`, and `range` is 3, 4, 5, 6, 7 or 10 ([BR-e] `ZSurveyRatingElement`). SurveyJS `rateType` is `labels`, `stars` or `smileys`, with `rateMin`, `rateMax` and `rateStep` ([SJ]).

**Display setting on `number`.** The stored answer is the integer. The icon does not change it. Formidabile already validates `integer`, `min` and `max`. A range edit stays on the same identity ([ADR-009] via [FB]). SurveyJS `rateValues` can be an author-defined list ([SJ]); if those values are not numbers, that configuration is single choice, not rating.

### NPS

A 0-to-10 "how likely are you to recommend" question. Typeform describes promoters as 9 or 10, passives as 7 or 8, and detractors as 6 or lower ([TF-q]). The Create API has `nps` ([TF-c]). The responses mapping table does not include `nps`, so the stored JSON was not on that page. Tally says it splits responses into those three groups in its own insights ([TA]). Formbricks' element has labels and a colour-coding flag, and no range property of its own ([BR-e] `ZSurveyNPSElement`).

**Display setting on `number`.** The answer is an integer in a fixed range, which `number` already stores. The three groups are an analysis of that integer, not a second value.

### Opinion scale and linear scale

A row of numbered steps with labels at the ends. Typeform stores `opinion_scale` as `number` (example `1`) ([TF-r]). Google Forms starts at 0 or 1 and ends on a whole number from 2 to 10, with a label at each end ([GF]). Tally's linear scale adjusts steps and labels ([TA]). Fillout lists Opinion scale next to Star Rating and Slider ([FO]).

**Display setting on `number`.** Same stored integer as a rating. The labels are presentation.

### CSAT

Tally: a 1–5 score, with an average shown in its insights ([TA]). Formbricks: `scale` of `number`, `smiley` or `star`, and `range` fixed at 5 ([BR-e] `ZSurveyCsatElement`).

**Display setting on `number`.** A rating whose range is fixed at 1–5. The average is analytics.

### CES

Formbricks only, in this set. `range` is 5 or 7, with the same three scales as CSAT ([BR-e] `ZSurveyCesElement`).

**Display setting on `number`.** The customer-effort label does not change the integer answer.

### Ranking

The respondent orders the options. Typeform has the type ([TF-q][TF-c]) and does not show its answer JSON in the responses mapping table. Formbricks requires 2 to 25 choices ([BR-e] `ZSurveyRankingElement`). SurveyJS `ranking` inherits checkbox and adds a select-to-rank mode ([SJ]).

**New question type.** The answer is a permutation: the same options in a different order are a different answer. Multiple choice stores a set. Order is not a display setting on that set.

### Matrix, one choice per row

Each row picks one column. Typeform's Matrix evaluates one or more row items within a set of column choices ([TF-q]). Google Forms' multiple-choice grid has rows, columns, and an optional "one choice per column" rule ([GF]). Formbricks stores `rows` and `columns`, each an `{ id, label }` list, with no cell-type flag ([BR-e] `ZSurveyMatrixElement`). SurveyJS `matrix` defaults `cellType` to `radio`, and can require every row and unique answers per column ([SJ]). Form.io's directory has a `survey` component ([IO-s]); its value shape was not read.

**New question type.** The answer is one option value per row, an object, not a single option value and not one flat list.

### Matrix, several choices per row

Google Forms' checkbox grid uses the same row and column model and the same optional column rule ([GF]). SurveyJS sets `cellType` to `checkbox` on the same `matrix` class ([SJ]). Typeform's help page does not say whether Matrix allows more than one column per row. Formbricks' schema has no such flag.

**New question type, and not the same type as the single-choice matrix.** A row then stores a list of option values rather than one. That is a different representation, so a config flag would change the answer schema of an existing identity, which a question identity cannot do ([FB]).

### Likert

Typeform and Tally both say a Likert scale is made with the matrix block ([TF-q][TA]). No product in this set has a Likert class of its own.

**Display setting on the matrix.** Ordered column labels do not change the per-row answer. A single statement with a scale and no grid is a rating or a single choice, not a matrix.

### Slider, one value

Fillout's Slider selects a value from a range ([FO]). SurveyJS `slider` defaults to `sliderType: "single"`, with `min` 0, `max` 100 and `step` 1 ([SJ]).

**Display setting on `number`.** One number inside a min, max and step. Step is a constraint the current `number` type does not have; it is still a constraint on a number, not a new representation.

### Slider, a range

SurveyJS `sliderType: "range"` selects two thumbs, with `minRangeLength` and `maxRangeLength` ([SJ]). The authoring sample does not show the stored value.

**New question type.** Two numbers whose order is the answer. A single `number` cannot hold both ends. The stored JSON itself was not in the fetched doc, so the pair-shaped conclusion is from `sliderType`, not from a response sample.

### File upload

The respondent attaches a file. Typeform stores `file_url` and says not to depend on the URL's shape ([TF-r]). It is on paid plans, with no tier named; Google Drive is a second destination ([TF-q]). Google Forms stores the file in the owner's Drive, can restrict type, count and size, requires the respondent to sign in to a Google account, and is unavailable in a shared drive or when an administrator turns on Data Loss Prevention ([GF]). Formbricks configures `allowMultipleFiles`, `maxSizeInMB` and `allowedFileExtensions` ([BR-e]). SurveyJS stores either a data URL in the survey data or uploads through `onUploadFiles` ([SJ-f]). Form.io pushes one object per file into the submission ([IO-c]).

**New question type.** The answer is a file reference or a file payload. A data URL is a string technically, and it is not a text answer: it is not trimmed, displayed, or aggregated as text.

### Signature

Typeform lets the respondent type, draw or upload, and stores `{ url, type }` where `type` is `typed`, `drawn` or `uploaded` ([TF-q][TF-r]). SurveyJS `signaturepad` stores `png`, `jpeg` or `svg` and defaults `storeDataAsText` to true ([SJ]). Form.io writes `signaturePad.toDataURL()` into the component value ([IO-c]).

**New question type.** The answer is an image of a signature, plus, for Typeform, how it was captured. A typed name alone would be `text`. That is not what these products store.

### Phone

A string restricted to a phone number. Typeform stores `phone_number: "+14151234567"` and configures the field per country ([TF-q][TF-r]). Formbricks and SurveyJS treat it as an input mode of open text ([BR-e][SJ]). Form.io has a separate `phonenumber` component ([IO-s]).

**New question type, for the same reason `email` is not `text`.** The JSON type is a string, so it fits the current answer union. The validation is not the text question's trim-and-length check. Putting it on `text` would let a question change from free text to a phone number without a new identity, and combined analytics would then mix the two ([FB]).

### URL

Typeform's Website field stores `url` ([TF-r]). Tally's Link block collects URLs ([TA]). Formbricks uses `inputType: "url"` on `openText` ([BR-e]). SurveyJS uses `inputType: "url"` ([SJ]). Form.io has `url` ([IO-s]).

**New question type, same situation as phone.** A string with URL validation. Storage is the existing string arm.

### Address

One question with several lines. Formbricks toggles `addressLine1`, `addressLine2`, `city`, `state`, `zip` and `country`, each `{ show, required, placeholder }` ([BR-e] `ZSurveyAddressElement`). Typeform, Jotform, Fillout and Form.io each ship an Address field ([TF-q][JF][FO][IO-s]). None of the fetched sources shows the answer JSON. Formbricks' response union allows `Record<string, string>`, which could hold it ([BR-r]); the writer was not read.

**New question type.** The answer is an object of strings. Six text questions would reuse `text`, but that is a different question identity per line, which is not what these products store as one answer.

### Time only

Tally uses a 24-hour value such as `13:30` ([TA]). Google Forms offers `hh:mm AM/PM` or a duration in hours, minutes and seconds, switched from the same question ([GF]). Jotform, Fillout, SurveyJS (`inputType: "time"`) and Form.io (`time`) each have a time field ([JF][FO][SJ][IO-s]).

**New question type.** A time of day is not a calendar date, and Formidabile's `date` is `YYYY-MM-DD` with no time ([FB]). Google Forms' duration is a second representation on the same control: a length, not a clock time. Those two do not share an answer schema.

### Date and time

Fillout lists Date time picker separately from Date picker ([FO]). Google Forms and Jotform add a time onto the date question ([GF][JF]). SurveyJS uses `inputType: "datetime-local"` on `text` ([SJ]). Form.io has `datetime` ([IO-s]). Typeform's date example is `2012-03-20T00:00:00Z`, a UTC midnight instant, while the help page only describes a calendar date ([TF-r][TF-q]).

**New question type.** Adding a time changes the value from a calendar date to an instant or a local date-time. That cannot stay on the `date` identity, whose values compare as `YYYY-MM-DD` strings ([FB]).

### Date range

Fillout lists Date range as its own field, a start and an end date ([FO]). Tally's date settings mention "specific dates or date ranges"; the page does not say whether the respondent's answer is one date or a pair ([TA]).

**New question type** for Fillout's field: the answer is two dates. One `date` value cannot hold the pair. Tally's wording is unverified as an answer shape.

### Dropdown, multi-select, combobox

Typeform's dropdown answer is `text`, the option label, not a choice object ([TF-r]). Formbricks' `displayType` is `list` or `dropdown` on both multiple-choice elements ([BR-e]). Fillout says switching Multiple choice to Dropdown keeps the answer, and Multiselect to Checkboxes does too ([FO]). SurveyJS `dropdown` and `tagbox` are their own classes; both can set `allowCustomChoices` ([SJ]). `tagbox` is the multi-select dropdown. SurveyJS `text` also has `dataList`, a list of suggestions on a text input ([SJ]).

**Dropdown is a display setting on `single_choice`. Multi-select dropdown is a display setting on `multiple_choice`.** That is the rule ADR-002 already states ([FB]), and Fillout's swap behaviour matches it. A combobox that only picks an existing option is the same display setting. A combobox that accepts a value outside the option list is `text` with suggestions, because the answer is no longer an option value. SurveyJS `allowCustomChoices` is that second case; the stored custom value was not in the fetched sample.

### Picture choice

Typeform stores a single picture choice as `choice.label` and several as `choices.labels`, the same shapes as multiple choice ([TF-r]). Formbricks' choices are `{ id, imageUrl }`, with `allowMulti` ([BR-e]). SurveyJS `imagepicker` has `multiSelect` and inherits the checkbox base ([SJ]). Tally adds images from the checkbox settings rather than a separate block ([TA]).

**Display setting on `single_choice` or `multiple_choice`.** The image is option presentation. The answer is still one option value, or a list of them.

### Yes/no

Typeform stores `yes_no` as `boolean` ([TF-r]). SurveyJS `boolean` displays as segmented buttons, radio, checkbox or switch, and can store custom `valueTrue` and `valueFalse` strings instead of booleans ([SJ]). Fillout's Switch is on/off ([FO]).

**Already `boolean`.** Labels and the switch control are display. SurveyJS's custom true/false strings are a different representation (two strings instead of a boolean) and would not fit this type.

### Long text

Typeform stores `long_text` as `text`, the same answer type as `short_text` ([TF-r]). Short text limits the character count to 0–999; long text has an optional limit and otherwise no maximum on that page ([TF-q]). Formbricks uses `longAnswer` on `openText` ([BR-e]).

**Display setting on `text`.** Already how Formidabile's `single_line` and `multi_line` work ([FB]). A product-specific maximum is a constraint, not a type.

### Statement, welcome, thank-you, page break, divider

Typeform's Statement, Welcome Screen and End Screen collect no answer; the help page says an Ending's type cannot be changed, and a Statement is for when you want to say something but don't need an answer ([TF-q]). Tally's block index has title, headings, divider, page break, image and embed ([TA-b]). Jotform's Header, Paragraph, Divider, Page Break and Section Collapse are structure ([JF]). Fillout's Text, Heading, Paragraph, Banner, Image, Video, PDF, HTML, Divider and Section collapse are display ([FO]). SurveyJS `html` and `image` inherit `nonvalue` ([SJ]). Form.io's layout components use `input: false`, and the Content component is not submitted back to the server ([IO-d]).

**Layout or content, not a question.** There is no answer to key by identity.

### Hidden fields

Typeform puts hidden fields in a `hidden` object on the response item, beside `answers` ([TF-r]). Tally passes them in through the URL and says the feature is free for every user ([TA]). Fillout lists `urlParameters` separately from `questions` ([FO-a]). Form.io's Hidden component is not visible to users but is submitted with the form data, and its schema sets `input: true` ([IO-d]).

**Not a question.** The respondent does not produce the value. Typeform and Fillout already keep it out of the answer map. Form.io stores it in `data` under the field key, which is a host-supplied string inside the submission, still not a respondent answer.

### Calculated and formula fields

Typeform returns `calculated.score` and a `variables` array of `{ key, type, number | text }` beside `answers` ([TF-r]). Fillout returns `calculations` as `{ id, name, type: "number", value: string }` beside `questions` ([FO-a]). Tally has calculated fields ([TA]); the block page had no schema. SurveyJS has an `expression` question and survey-level `calculatedValues` ([SJ]). The expression's stored result was not in the sample. Form.io's guidance is to put a calculated value in a Hidden component ([IO-d]).

**Not a question.** Nothing is asked. Where the shape is documented, it is a number or a string computed from answers, stored beside them.

### Payment

Typeform's Payment field is on paid plans and uses Stripe or PayPal; the answer type is `payment`, with no example object on the responses page ([TF-q][TF-r]). Tally's block uses Stripe ([TA]). Jotform has a Product List field and a Payments tab of gateways ([JF]). Fillout's submission payment object is `paymentId`, Stripe customer and payment URLs, `totalAmount`, `currency`, `email`, `discountCode`, `status` and an optional subscription id ([FO-a]).

**New question type if it is stored as the respondent's answer.** The value is an object about a charge, not a number the respondent typed. Fillout keeps it in `payments`, not in `questions`, so it can also be modelled as a side record. Either way it is not `number`: the currency, the status and the processor ids are part of the stored result.

### Scheduling

Typeform's Scheduler connects to Google Calendar or Calendly, and both `calendly` and `google_calendar` answers are a `url` ([TF-q][TF-r]). Fillout's scheduling value is an object: full name, email, timezone, event start and end, event id, event URL, reschedule URL, user id, host email and meeting notes ([FO-a]). Jotform's Appointment field limits bookings per slot ([JF]). Formbricks' `cal` element stores `calUserName` and an optional `calHost` on the question, not a documented answer ([BR-e]).

**New question type.** A booking is an instant plus an external event id. Typeform's URL is only a reference to that booking, and Fillout stores the booking itself. Neither is a date the respondent typed into a date field.

### Country and currency

No product here has a country question whose answer is something other than a choice or an address subfield. SurveyJS exposes `country` as an `autocomplete` token on a text or dropdown input ([SJ]). Tally's Respondent country block is auto-captured ([TA-b]); its stored value was not on the empty block page.

Fillout has a Currency field ([FO]). SurveyJS applies `maskType: "currency"` to `text` ([SJ]). Form.io has a `currency` component ([IO-s]). None of the three shows whether the stored value is a number, a formatted string, or a number plus a currency code.

**Country, chosen from a list, is `single_choice`.** An auto-captured country is a hidden field, not a question. **A currency amount is a constraint on `number` when the code is fixed on the question. It is a new question type when the answer stores the amount and the code together.** Which of those Fillout, SurveyJS and Form.io do is unverified.

### Consent checkbox

Typeform's Legal answer is `boolean: true` ([TF-r]). Its Checkbox answer is a `choices` array that, on that page, holds one item `{ id, label, ref }` ([TF-r]). Formbricks' `consent` element adds a `label` and no other answer config ([BR-e]). Formidabile's `boolean` has no "must be checked" mode: required means the respondent picks yes or no ([FB]).

**Display and validation on `boolean`.** The answer is still true or false. "Required means must be true" is a constraint the current boolean type does not have. It does not change the representation. Typeform's choice-shaped checkbox is the same fact stored as a one-element list; under this glossary that list is the boolean.

### Autocomplete and lookup

SurveyJS `choicesByUrl` fills a dropdown from a URL ([SJ]). Fillout's Record picker selects records from Airtable or Notion, and Submission picker copies answers from another form ([FO]). The picked value's JSON was not in the API example (`value` is `<unknown>`).

**A fixed suggestion list is a display setting on `single_choice` or on `text`.** A lookup whose options are not part of the form version is a new question type: the answer is an external id, and the version no longer contains the option list that gives the id its meaning. That collides with reading an answer through its own version ([FB]).

### CAPTCHA

Tally inserts reCAPTCHA with `/bot` ([TA]). Jotform has a Captcha field and optional Google reCAPTCHA ([JF]). Fillout's Captcha proves the respondent is human ([FO]). Form.io has `recaptcha` ([IO-s]). No fetched page shows a stored answer.

**Not a question.** It is a gate on submit. There is no answer to analyse. The token, if stored at all, was not documented in the pages read.

### Video and audio answers

Typeform stores `multi_format` as `{ audio_url, audio_transcript }` or `{ video_url, video_transcript }` ([TF-r]). Fillout's Voice recording transcribes automatically ([FO]); the stored JSON was not in the submissions schema. SurveyJS `file` can take `sourceType: "camera"` ([SJ]), which is still a file answer.

**New question type** for Typeform's shape: a media URL plus a transcript, not a file URL alone and not text alone.

### Contact info and full name

Typeform's Contact Info and Formbricks' `contactInfo` bundle several fields in one question. Formbricks toggles first name, last name, email, phone and company ([BR-e]). Jotform's Full Name is first and last name instead of two text boxes ([JF]). The answer JSON was not in the Typeform mapping table. Formbricks' response union allows a string-to-string record ([BR-r]).

**New question type** as these products ship it: one answer object whose fields are strings, an email and a phone. Split into `text`, `email` and phone questions, each field is an existing type. The bundled object is the part the current union cannot store.

### Rich text, password, color

Fillout's Rich text answer stores formatted text ([FO]). A formatted string is still a string; the current text answer is trimmed plain text ([FB]). **Display setting on `text` only if the stored value is the text the respondent sees. If HTML is stored, the validation (which tags survive) differs, and that was not specified.**

Fillout's Password and Form.io's `password` collect a secret string ([FO][IO-s]). SurveyJS uses `inputType: "password"` ([SJ]). **Display setting on `text` for the representation.** The value is a string. Whether a form answer should hold a password at all is outside the type question; the pages do not say they hash it.

Fillout's Color picker is a predefined set of options or a color picker ([FO]). SurveyJS uses `inputType: "color"` ([SJ]). **A predefined set is `single_choice`. A picker stores a colour string, which is `text` with a format constraint.** The stored form (hex string or otherwise) was not shown.

### Location

Fillout collects geographic location coordinates ([FO]). The value shape was not in the API schema.

**New question type**, on the description alone: a coordinate is not a number and not a text answer. The JSON (a pair, a string, or an object) is unverified, so which new schema it needs is unverified too.

### Repeating rows, input tables, fill-in-the-blank

SurveyJS `matrixdynamic` and `paneldynamic` let the respondent add rows or panels ([SJ]). Form.io's Data Grid and Edit Grid save an array of row objects; Data Map saves key/value pairs; Container groups child values into one object under its key ([IO-d]). Fillout's Table is multiple rows and columns ([FO]). Jotform's Input Table displays input fields in a table ([JF]). Jotform's Fill In The Blank and SurveyJS `multipletext` collect several values inside one prompt ([JF][SJ]).

**New question type.** The answer is an array of objects, or an object of heterogeneous values. A matrix of choice cells is the choice matrix above. A table of text or number cells is a third shape: rows of answers, not rows of option values.

### Tags

Form.io has a `tags` component ([IO-s]). Its value schema was not read. SurveyJS `tagbox` selects many choices, and `allowCustomChoices` lets the respondent add one ([SJ]).

**A tag box bound to a fixed option list is `multiple_choice`. Free-typed tags are a new question type:** a list of strings that are not option values snapshotted on the version.

### Spinner

Jotform's Spinner increments a number ([JF]).

**Display setting on `number`.**

### Clarify with AI and FAQ with AI

Typeform's help menu describes Clarify as up to two generated follow-up questions, and FAQ as answers drawn from a knowledge base the author entered ([TF-q]). Neither name is in the Create API field enum read on the same day ([TF-c]). No answer JSON was found.

**Unverified.** If the only stored respondent answer is the text they typed, it is `text`. The page does not say whether the generated follow-ups are stored as further answers.

### Subform

Fillout's Subforms collect nested forms within the main form ([FO]). Form.io's `form` component is in the directory ([IO-s]); its value was not read. Fillout's value JSON was not in the submissions schema.

**New question type.** A nested submission is an object of answers, not one of the seven value kinds. The exact nesting is unverified.

### Respondent country

Listed in Tally's block index ([TA-b]). The page body was empty. The name and the neighbouring hidden-field feature are the only evidence.

**Not a question**, if it is auto-captured as the index implies. The stored value is unverified.

## 3. How answers are represented

Formidabile stores one untagged value per question identity: a string, a number, a boolean, or an array of strings ([FB]). The version, not the value, says which type it is. The shapes below are what would have to sit in that position, or beside it.

### Typeform

Answers are a list of tagged objects, not a map. Each object carries `field.id`, `field.type`, `field.ref`, an answer `type`, and the value under a key named after that type. Order is not the form order ([TF-r]).

Documented pairs:

| Field `type` | Answer `type` | Value |
|---|---|---|
| `short_text`, `long_text`, `dropdown` | `text` | string, and for dropdown the option label |
| `multiple_choice`, `picture_choice` (one) | `choice` | `{ label }` |
| `multiple_choice`, `picture_choice` (many) | `choices` | `{ labels: string[] }` |
| `email` | `email` | string |
| `website`, `calendly`, `google_calendar` | `url` | string |
| `phone_number` | `phone_number` | `"+14151234567"` in the sample |
| `yes_no`, `legal` | `boolean` | `true` or `false` |
| `checkbox` | `choices` | `[{ id, label, ref }]` |
| `rating`, `opinion_scale`, `number` | `number` | number |
| `date` | `date` | `"2012-03-20T00:00:00Z"` |
| `file_upload` | `file_url` | URL string; shape not stable |
| `signature` | `signature` | `{ url, type: "typed" \| "drawn" \| "uploaded" }` |
| `multi_format` | `multi_format` | `{ audio_url, audio_transcript }` or the video pair |
| `payment` | `payment` | key named; object not shown |

`nps`, `ranking`, `matrix`, `address` and `contact_info` are field types ([TF-c]) and are not in that mapping table. Hidden fields and scores sit beside `answers`:

```json
"hidden": {},
"calculated": { "score": 4 },
"variables": [{ "key": "score", "type": "number", "number": 4 }]
```

Choice answers store the label. Relabelling an option changes what a later response writes. Formidabile stores the option value and keeps the label on the snapshot, so a relabel does not change the answer ([FB]).

### Tally

The submissions endpoint exists ([TA-v] points at the same API). No submission body and no block schema could be read: the block markdown pages returned titles only ([TA-b]). The help page says what the respondent enters (a URL, a 24-hour time, a star count, a 1–5 CSAT, an NPS category) and not the JSON ([TA]). **Answer JSON: unverified.**

### Google Forms

The question-menu article describes values in prose and publishes no response schema ([GF]). A linear scale is a whole number. A rating is a whole number from 3 to 10. A date is `mm/dd/yyyy`, optionally with a year or a time. A time is `hh:mm AM/PM` or a duration. A file is a Drive file, not an inline payload. Multiple choice can include an "Other" short answer, so one response can be either an option or typed text. **Wire JSON: unverified.**

### Jotform

The field overview publishes no answer schema and no API example ([JF]). **Unverified.**

### Fillout

A submission question is `{ id, name, type, value }` and `value` is `<unknown>`. The docs say unknown field types should be discarded. Calculations, URL parameters, scheduling and payments are siblings of `questions`, not entries inside it ([FO-a]):

```json
"calculations": [{ "id": "<string>", "name": "<string>", "type": "number", "value": "<string>" }],
"urlParameters": [{ "id": "<string>", "name": "<string>", "value": "<string>" }],
"scheduling": [{
  "value": {
    "fullName": "<string>",
    "email": "jsmith@example.com",
    "timezone": "<string>",
    "eventStartTime": "2023-11-07T05:31:56Z",
    "eventEndTime": "2023-11-07T05:31:56Z",
    "eventId": "<string>",
    "eventUrl": "<string>"
  }
}],
"payments": [{
  "value": {
    "paymentId": "<string>",
    "totalAmount": 123,
    "currency": "<string>",
    "status": "<string>"
  }
}]
```

Per-question `value` for rating, matrix, ranking, file and address: **unverified.**

### Formbricks

`data` is a record from element id to this union ([BR-r]):

```ts
z.union([
  z.string(),
  z.number(),
  z.array(z.string()),
  z.record(z.string(), z.string()),
]).optional()
```

So a stored answer can be a string, a number, a list of strings, or an object whose values are all strings. It cannot be a boolean, a file object, a nested object, or an array of objects. The schema does not say which element writes which arm. Ranking's choices and the matrix's rows and columns are `{ id, label }` ([BR-e]), which is compatible with an id list and a row-id to column-id record, and that assignment was not read in the response writer. File upload, address and contact info have element schemas and no value schema in the files read. **Per-type assignment: unverified. The allowed union: verified.**

### SurveyJS

The authoring doc's JSON is the question, not the result ([SJ]). Two value facts are in source or in a property description.

`file` reports its value type as `"array"`. Each entry may be an object or a string. With `storeDataAsText` (default `true`), the object written into survey data is `{ name, type, content }` and `content` is a data URL ([SJ-f] L574–L588, L943–L952, L1378):

```ts
{ name: file.name, type: file.type, content: fileReader.result }
```

`signaturepad` uses the same `storeDataAsText` description and a `dataFormat` of `png`, `jpeg` or `svg` ([SJ]). The signature value assignment was not in `question_file.ts`.

`boolean` saves `valueTrue` and `valueFalse` when those are set; otherwise the doc does not show the default boolean ([SJ]). `matrix` with `cellType` `radio` or `checkbox` is the question schema only. Ranking's sample is the question and its `choices`, not the ordered answer. **Matrix, ranking, rating and signature result JSON: not in the sources read.**

### Form.io

A submission is `{ data, metadata, state, form, ... }` and `data` holds field keys ([IO-d]):

```json
{ "data": { "firstName": "Sally", "lastName": "Thompson" }, "state": "submitted" }
```

A signature's value is the data URL passed to `setValue` ([IO-c]):

```js
this.setValue(this.signaturePad.toDataURL(), { modified: true })
```

A file's stored value is an array. On a successful upload the component appends `fileInfo`, then sets `originalName` and `hash` ([IO-c]). The object started for each file has `id`, `dir`, `name`, `originalName`, `fileKey`, `storage`, `size` and `status` ([IO-c]). Which of those keys survive into `data` depends on the storage provider's response. **Full file object: not fixed by the source read.**

Container nests child values in one object. Data Map stores an object of string keys. Data Grid's schema shows `defaultValue: [{}]` and the docs describe an array of row objects ([IO-d]). The `survey` component (their grid) was not read.

## 4. Facts and tradeoffs for Formidabile

These follow from the sources above and from the current answer union. They are not a proposal.

**Shapes the union already holds.** Rating, NPS, opinion scale, CSAT, CES and a single slider are numbers with a min, a max and an integer constraint. Phone, URL, time of day, a colour string and a password are strings with a different check than `text` or `email`. Dropdown, picture choice and a single yes/no are the existing choice and boolean answers. Consent is a boolean with a different required-rule. None of these need a new arm of `AnyAnswers`. They do need a decision about identity: email was split out as its own type while long text was not, so "string with its own validation" is not by itself a reason to mint a type, and it is the reason a phone question cannot later become plain text on the same identity ([FB]).

**Shapes the union does not hold.**

| Shape | What forces it | What the current union would do |
|---|---|---|
| Ordered `string[]` | Ranking. Order is the answer, unlike multiple choice. | The array arm can hold the strings. Nothing in the schema says the order is significant. |
| `Record<row, string>` | Single-choice matrix. | Not in the union. Formbricks allows this record only when every value is a string ([BR-r]). |
| `Record<row, string[]>` | Multi-choice matrix. | Not in the union. |
| File reference, or `{ name, type, content }` | File upload. | A URL is a string. A data URL is a string large enough to matter. An object is not in the union. |
| `{ url, type }` or a data URL | Signature. | Same as file. Typeform's `typed` / `drawn` / `uploaded` is a second field on that object ([TF-r]). |
| Object of named strings | Address, contact info. | Not in the union unless it is flattened into one string, which these products do not do. |
| Two dates, or two numbers | Date range, range slider. | Two values, one key. |
| Booking object, or a URL plus an external event | Scheduling. Fillout's object is the documented one ([FO-a]). | A URL fits the string arm and drops the start, the end and the event id. |
| Payment object | Fillout's `payments` value ([FO-a]). | Not a number. Often stored beside answers. |
| Array of row objects | Repeating table, data grid. | Not in the union. |
| Media URL plus transcript | Typeform `multi_format` ([TF-r]). | Two strings with different jobs. |

**Versions and analytics.** A question identity cannot change type ([FB]). Anything judged a display setting (dropdown, long text, stars versus numerals, picture versus text options) can stay on the current identity. Anything judged a new type needs a new identity the day it is introduced, including for forms that already have answers.

Where the new type reuses an option list, the existing option rule applies: a matrix row or a ranking option that only some versions offer is absent, not unanswered, in the others ([FB]). A rating's range change is the case already decided for `number`: the combined mean stays, and each version's range is shown. NPS buckets are that same mean, counted three ways. They do not need their own identity unless the stored value becomes the bucket instead of the integer.

Matrix and ranking answers are only comparable across versions when the row ids and option values survive, the way choice option values already must. Typeform's choice payload stores labels ([TF-r]). Combining those across a relabel means combining different strings. Formidabile's option values avoid that for choice; a matrix or ranking stored as labels would reintroduce it.

File and signature values have to remain readable for a superseded version, because a response is read through the version it was submitted against and never moved ([FB]). A storage URL that expires, or a data URL that lived only in the request, breaks that read. Typeform warns that `file_url`'s shape can change ([TF-r]).

Hidden fields, calculations, CAPTCHA and auto-captured country are not answers in the products that document a payload. Putting them in the answer map would give them a question identity and a type for life. Leaving them out matches Typeform's `hidden` / `calculated` and Fillout's side arrays ([TF-r][FO-a]).

**The strict CSP.** The host policy in the renderer spike is `default-src 'self'; script-src 'self'` ([CSP]).

- A signature pad written into the renderer bundle does not need a third-party script. Form.io draws on a canvas and stores a data URL ([IO-c]). SurveyJS can do the same with `storeDataAsText` ([SJ]). That fits the policy. Loading a signature widget from another origin does not.
- A file stored as a data URL also fits the policy, and it lands in the JSON body. SurveyJS' default is that data URL ([SJ-f]). The published definition already assumes a 1 MiB request ceiling ([FB]). A file answer and that ceiling cannot both be ignored.
- Uploading the file to another origin needs `connect-src` (and usually a preflight) that `default-src 'self'` does not grant. Google Forms avoids this by sending the respondent to their own Drive account ([GF]), which is a navigation, not a call from the embed.
- Typeform Payment and Tally's Stripe block are processor checkouts ([TF-q][TA]). Fillout's stored result is Stripe ids and URLs ([FO-a]). A card form in an iframe needs `frame-src` for the processor. The spike's policy does not allow it.
- reCAPTCHA, as Tally, Jotform, Fillout and Form.io name it ([TA][JF][FO][IO-s]), loads a Google script and usually a Google frame. Both are blocked by the spike's policy. There is no answer shape to store in exchange.
- Fillout's HTML field and Form.io's HTML and Content components inject markup ([FO][IO-d]). Form.io strips unsafe tags in the HTML Element. The renderer does not currently have a sanitiser, and `script-src 'self'` blocks inline scripts. An author-supplied HTML block is a content element that the CSP would neuter, not a question.
- Formbricks' external CTA opens a URL with `window.open` and rejects `javascript:` URLs ([BR-e] `ZSurveyCTAElement`). That is a link, not a script. It does not need a CSP exception. It also collects no answer.
- Scheduling embeds (Calendly, Google Calendar, Cal.com) are third-party frames ([TF-q][BR-e]). Same `frame-src` problem as payment. Typeform's stored answer is only the event URL ([TF-r]), which can be recorded without embedding the calendar, if the booking happens somewhere the CSP allows.

### Open questions for the owner

- Phone and URL are strings with their own validation, which is also true of email, and email is its own type. Should the glossary's "validation" clause keep treating that as a new type?
- Ranking fits in `string[]`. Should order become part of the multiple-choice answer, or a separate type whose array means a permutation?
- Single-choice and multi-choice matrices need different value schemas. Are they two types?
- File and signature can be a URL or a data URL. Which of those is the answer, and which is storage?
- Address and contact info can be one object or several existing questions. The products do both, sometimes in the same product (Jotform has Full Name and also Short Text).
- Payment, scheduling, hidden fields and scores are answers in some payloads and side records in others. The current module has external references and has no side channel on a response for calculated values.
- Fillout's per-type plan marker, Tally's answer JSON, and the Typeform answer JSON for matrix, ranking, NPS, address and contact info were not available. Several verdicts above rest on the control's description rather than on a sample value.

## 5. Could not verify

- Typeform answer JSON for `nps`, `ranking`, `matrix`, `address`, `contact_info` and `payment`. They are field types; the responses mapping table and samples do not include their value objects ([TF-c][TF-r]).
- Whether Typeform Matrix allows more than one selection per row ([TF-q] describes rows and columns only).
- Typeform Clarify with AI and FAQ with AI answer shape. Named in the help menu, absent from the Create API enum that was read ([TF-q][TF-c]).
- Tally answer JSON for every block, including rating, matrix, ranking, file upload, signature, payment and calculated fields. The block pages returned titles only, and the submissions response body was not read ([TA-b][TA-v]).
- Whether Tally's "date ranges" setting stores a range or only limits a single date ([TA]).
- Google Forms response JSON. The help page has no schema ([GF]).
- Jotform response JSON, plan tiers, and the contents of the Widgets tab. Slider, Likert, address autocomplete and a dedicated yes/no were not in the core field list and were not confirmed as widgets ([JF]).
- Which Fillout field types carry the paid-plan marker. The page states the policy; the marker did not survive the fetch ([FO]).
- Fillout `value` for rating, matrix, ranking, file upload, signature, address, currency, color, location, rich text, table and subform. The API types `value` as `<unknown>` ([FO-a]).
- Formbricks' assignment of element type to an arm of `ZResponseDataValue`, in particular address, matrix, contact info, ranking, file upload and `cal` ([BR-r][BR-e]).
- SurveyJS result JSON for matrix, matrixdropdown, ranking, rating, slider range and signature. The authoring samples are question JSON. Only the file value was read from source ([SJ][SJ-f]).
- The default stored value of SurveyJS `boolean` when `valueTrue` and `valueFalse` are unset ([SJ]).
- Form.io's stored file object after the storage provider returns, and the `survey`, `address`, `currency`, `tags`, `datetime`, `time` and `select` value schemas. Only the signature data URL and the pre-upload file record were read ([IO-c][IO-s]).
- Form.io enterprise components that are not in `formio.js` `src/components` ([IO-s]).
- Whether Typeform's signature widget, Fillout's HTML field, or Formbricks' Cal.com embed can run under `default-src 'self'; script-src 'self'`. The CSP conclusion above is from what those products load (a canvas, author HTML, a third-party scheduler), not from a test inside this renderer ([CSP][TF-q][FO][BR-e]).
