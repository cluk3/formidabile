# How form builders present individual responses

Researched 2026-10-22. This note is about the admin view of individual responses: the table or the one-response view, and the list APIs a host would build a view on. Aggregate charts are out of scope. Export is covered only as an action on the response view.

SurveyJS Analytics and Form.io are not hosted form products. SurveyJS Analytics is a browser table. Form.io is a self-hosted portal plus an API. A "no" for either of them means the component does not do it, not that a plan withholds it.

## Sources

Docs were fetched on 2026-10-22. Source was read at the commits below.

- **[TF]** Typeform Help, [Working with your responses](https://help.typeform.com/hc/en-us/articles/360029253732-Working-with-your-responses).
- **[TFp]** Typeform Help, [Collect partial responses](https://help.typeform.com/hc/en-us/articles/21102221958676-Collect-partial-responses).
- **[TFg]** Typeform Developers, [Retrieve responses](https://www.typeform.com/developers/responses/reference/retrieve-responses/) (`GET /forms/{form_id}/responses`).
- **[TFs]** Typeform Developers, [Search responses using advanced filters](https://www.typeform.com/developers/responses/reference/search-responses-using-advanced-filters/) (`POST /forms/{form_id}/responses/search`).
- **[TY]** Tally Help, [How do I delete responses?](https://tally.so/help/how-do-i-delete-responses).
- **[TYp]** Tally Help, [Partial submissions](https://tally.so/help/partial-submissions).
- **[TYt]** Tally Help, [How to delete and recover form data](https://tally.so/help/how-to-delete-and-recover-form-data).
- **[TYa]** Tally Developers, [Listing submissions](https://developers.tally.so/api-reference/endpoint/forms/submissions/list) (`GET /forms/{formId}/submissions`).
- **[GF]** Google Docs Editors Help, [View & manage form responses](https://support.google.com/docs/answer/139706?hl=en).
- **[GFd]** Google Docs Editors Help, [Choose where to save form responses](https://support.google.com/docs/answer/2917686?hl=en).
- **[GFa]** Google Forms API, [forms.responses.list](https://developers.google.com/forms/api/reference/rest/v1/forms.responses/list) (page updated 2025-02-27).
- **[JFv]** Jotform Help, [How to View Form Submissions](https://www.jotform.com/help/269-how-to-view-form-submissions/) (last update 2026-08-10).
- **[JFf]** Jotform Help, [How to Filter Entries in Jotform Tables](https://www.jotform.com/help/1009-how-to-filter-entries-in-jotform-tables/) (last update 2026-08-25).
- **[JFe]** Jotform Help, [How to Edit Submissions in Jotform Tables](https://www.jotform.com/help/325-how-to-edit-submissions-made-on-your-forms) (last update 2024-11-23).
- **[JFi]** Jotform Help, [How to Search and Filter Submissions in Jotform Inbox](https://www.jotform.com/help/how-to-filter-and-search-submissions-in-inbox/).
- **[JFa]** [Jotform API docs](https://api.jotform.com/docs/), fetched 2026-10-22. The submissions section documents `offset`, `limit`, `orderby` and `filter`, and shows a sample body whose `resultSet.limit` is 100 and whose `filter` is `{"new":"1"}`.
- **[JFp]** `jotform/jotform-api-php` `JotForm.php` on `master`, fetched 2026-10-22. `getFormSubmissions` is at lines 318–328 and `createConditions` at 167–178.
- **[FO]** Fillout Help, [View form responses](https://support.fillout.com/help/view-responses).
- **[FOc]** Fillout Help, [Comment on form submissions](https://www.fillout.com/help/comment).
- **[FOa]** Fillout Help, [Get all submissions](https://support.fillout.com/help/api-reference/get-all-submissions).
- **[FOn]** Fillout Help, [What's new](https://www.fillout.com/help/whats-new). Only the sentences quoted below were used. A line that sits under a Zite heading was not treated as a Fillout forms feature.
- **[FBd]** Formbricks docs, [Reading Survey Results](https://formbricks.com/docs/surveys/analysis/reading-results).
- **[FBv2]** Formbricks docs, [Get responses](https://formbricks.com/docs/api-v2-reference/management-api--responses/get-responses) (API v2).
- **[FBsrc]** `formbricks/formbricks` commit [`b787dc04`](https://github.com/formbricks/formbricks/commit/b787dc04c35de1514a5841db483003aef1d72b92) (2026-10-22). Paths below are relative to that tree.
- **[SJs]** `surveyjs/survey-analytics` commit [`9a649e74`](https://github.com/surveyjs/survey-analytics/commit/9a649e74ee126bd3713e294e42d00826ccff86eb) (2026-10-20), package version 3.2.2 (`package.json`).
- **[IOd]** Form.io Help, [Accessing Submissions](https://help.form.io/form-building/submissions/accessing-submissions).
- **[IOs]** `formio/formio` commit [`8b9fe9a2`](https://github.com/formio/formio/commit/8b9fe9a29dfcd452f1ab7385b8921b06b70eb6dc) (2026-10-14). `package.json` version `4.5.0-rc.1`, dependency `resourcejs` `2.6.2-dev.151.789661d`.
- **[RJS]** `resourcejs@2.6.1` `Resource.js` on unpkg. The `2.6.2-dev` commit Form.io declares did not resolve (GitHub returned 404 for `formio/resourcejs` and for tag `789661d`). Selector and paging behaviour below is 2.6.1. Whether 2.6.2-dev differs was not checked.

Formidabile, cited only in §5:

- [ADR 0002](../../../docs/adr/0002-mvp-product-calls.md), [ADR 0005](../../../docs/adr/0005-form-definition-model.md), [ADR 0007](../../../docs/adr/0007-answer-rows-and-trigger-enforced-persistence-invariants.md), [ADR 0009](../../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md), [ADR 0010](../../../docs/adr/0010-respondent-api-split-and-host-owned-lookups.md), [ADR 0012](../../../docs/adr/0012-response-references-are-host-signed-claims.md), [ADR 0013](../../../docs/adr/0013-personal-data-is-erased-by-hard-deletion-under-pseudonymous-subjects.md).
- `packages/http-api/lib/api.ts` `ResponseListQuery` and `ResponsesGroup`.
- Tickets [35](../../form-builder-mvp-build/issues/35-admins-list-and-read-responses.md) and [38](../../form-builder-mvp-build/issues/38-builder-shows-and-deletes-responses.md).

## 1. Summary table

Rows are the response-view features. A cell says what is documented, then the source key. **unverified** means the pages and files listed above do not say. Plan gates are in the cell.

| Feature | Typeform | Tally | Google Forms | Jotform | Fillout | Formbricks | SurveyJS | Form.io |
|---|---|---|---|---|---|---|---|---|
| Table view | Yes. Newest first. [TF] | Yes. A Submitted-at column, with row checkboxes. [TY] | Summary and Individual in Forms. The table is a linked Sheet. [GF] [GFd] | Jotform Tables. [JFv] | Results table. [FO] | Responses tab, one row per submission. [FBd] | Tabulator table. [SJs `src/tables/tabulator.ts`] | Data-tab table. [IOd] |
| Single-response view | Expand a row, then arrows between responses. [TF] | API `previewUrl`, a signed URL with no expiry. The UI article does not describe opening one response. [TYa] [TY] | Individual, Previous and Next. [GFd] | Edit Entry opens the submission. A read-only single view is not described. [JFe] | Expand a cell, then up and down arrows. [FO] | `SingleResponseCard`, opened from the table. [FBsrc `…/SingleResponseCard/index.tsx`] | A details row under the record, not a separate page. [SJs `src/tables/extensions/detailsextensions.ts`] | View icon, and a PDF of one submission. [IOd] |
| Card or timeline list | No. The individual view is one open response. [TF] | unverified | No. [GF] [GFd] | Inbox is a second submissions UI. Whether it is cards is unverified. [JFi] [JFv] | No. [FO] | The list is the table. The opened response is a card. [FBd] [FBsrc card] | No. [SJs] | No. [IOd] |
| Column show, hide, reorder, resize | All three. Settings persist only if Tailor-made Typeform is on. [TF] | unverified | Not in the Forms articles. What Sheets allows was not read. [GF] | "Adding or changing views" is documented. Show, hide, reorder and resize are not. [JFv] | Hide, from the column-header menu. Resize unverified. [FO] | Hide, drag-reorder and resize. Order and visibility are stored in `localStorage` per survey. [FBsrc `ResponseTable.tsx`] | Hide, drag-reorder and resize. A column can be moved into the details row. [SJs `columnextensions.ts`, `tabulator.ts`] | Show or hide by the field's Table View checkbox. Reorder and resize not documented. [IOd] |
| Sort by column | Fixed: newest first. Per-column sort not documented. [TF] | UI unverified. The list API has no sort parameter. [TYa] | Not documented. [GF] | UI unverified. API `orderby` is a submission field name. [JFa] [JFp] | Header menu sorts the table. API `sort` is `asc` or `desc` on the whole list, default `asc`. [FO] [FOa] | The table instance has no sorting state. v3 API sorts only by `createdAt`. [FBsrc `ResponseTable.tsx`] [FBsrc `api_v3_responses.yml`] | Per-column asc then desc. [SJs `columnextensions.ts`, `tabulator.ts` `sortByColumn`] | UI not documented. API `sort`. [IOd] [RJS] |
| Filter by answer value | Multiple choice, picture choice, matrix and dropdown. Several answers on one question are OR. [TF] | UI unverified. API `filter` is only `all`, `completed` or `partial`. [TYa] | Not documented. [GF] | Advanced filter on a field and a value. [JFf] | A Filter control, and a changelog line for filtering by custom columns. Operators not documented. [FO] [FOn] | In the app, on any answer. v3 API refuses answer filters on purpose. [FBd] [FBsrc `api_v3_responses.yml`] | Substring (`like`) on that column's displayed text. [SJs `tabulator.ts` `applyColumnFilter`] | Mongo-style operators on stored fields, including `data.*`. [RJS] [IOs `setFilterQueryTypes.js`] |
| Filter by date range | Yes. [TF] | API `startDate` and `endDate`. UI unverified. [TYa] | UI not documented. API is only `timestamp > N` or `timestamp >= N`. [GF] [GFa] | Submission-date presets or a custom range. Other date fields use greater-or-equal and less-or-equal. [JFf] | Presets and a custom range, in the browser's timezone. A saved "This month" becomes a fixed Custom range next month. [FO] | Shared time-range control on Summary and Responses. [FBd] [FBsrc `response-filter-context.tsx`] | No date filter in the table code. [SJs `tabulator.ts`] | No date-range UI documented. Date values are parsed when used as query values. [IOd] [RJS] |
| Filter by respondent, identity or metadata | UI: tag and response type. API: `metadata.{key}` and `hidden.{key}`. [TF] [TFs] | API has no respondent parameter. Each answer carries `respondentId`. UI unverified. [TYa] | Email can be collected, and Summary lists who responded. A filter on a person is not documented. [GF] [GFd] | Unread, read, starred, unstarred. A filter on a person is not documented. [JFf] | Not itemized in the Results article. API has no respondent parameter; a login page adds `login.email`. [FO] [FOa] | Answer, tag, hidden field or metadata. [FBd] | No respondent model. [SJs `table.ts`] | `ownerFilter` on the index. No identity filter in the UI article. [IOs `SubmissionResource.js`] [IOd] |
| Free-text search across answers | Search box, combinable with the other filters. API `query` is an exact phrase. [TF] [TFg] | unverified | Not documented. [GF] | Inbox search bar. Tables searches "terms". [JFi] [JFf] | ⌘F or Ctrl+F on a cell. API `search` is a string. [FO] [FOa] | Filter operators include `contains`, `startsWith` and `endsWith`. The responses page has no separate search box. [FBsrc `packages/types/responses.ts`] [FBsrc `ResponsePage.tsx`] | `applyFilter` keeps a row if any string cell contains the text. [SJs `tabulator.ts`] | `__regex` on a field. No search box in the UI article. [RJS] [IOd] |
| Saved views or filters | Column settings persist with Tailor-made Typeform. Saved filters not documented. [TF] | unverified | Not documented. [GF] | Filtered entries can be saved into tabs. [JFf] | A saved view. Its dates are fixed, not a preset. [FO] | Columns persist in `localStorage`. Filters are component state and are reset when the page is opened without `referer`. [FBsrc `ResponseTable.tsx`, `ResponsePage.tsx`] | `state` get and set covers columns and page size. The host persists it. [SJs `table.ts`] | Not documented. [IOd] |
| Pagination | UI paging not specified. Thousands of responses are slow; the article points at export or webhooks. API: `before`/`after` cursors; use `since`/`until` or cursors above 1000. [TF] [TFg] | UI selects one page, up to 50. API: `page` (default 1) and `afterId`; `limit` default 50, max 500. [TY] [TYa] | Individual is Previous/Next. API `pageToken`, `pageSize` default at most 5000. Summary hidden above 50,000; question and individual views gone above 10,000; Sheets sync stops above 100,000; CSV unsorted above 10,000. From September 2026: 500,000 responses and 1 GB per form. [GFd] [GFa] [GF] | UI paging not specified. API `offset` and `limit`. The sample page has `limit` 100. No maximum on the docs page. [JFv] [JFa] | UI paging not specified. API `offset` (default 0), `limit` 1–150, default 50. [FO] [FOa] | UI infinite scroll, pages of 25 (`RESPONSES_PER_PAGE`). v2: `skip`/`limit`, max 250, default 50. v3: keyset cursor, `limit` 1–250, default 20. [FBsrc `lib/constants.ts`, `ResponsePage.tsx`] [FBv2] [FBsrc v3] | Local pages. Default size 5. Selector 1, 5, 10, 25, 50, 100. Remote mode sends `offset` and `limit`. [SJs `table.ts`, `tabulator.ts`] | `skip` and `limit`. Default `limit` 10. No maximum in the parser. Also a `Range` header. [RJS] |
| Bulk select and delete | Select rows, or the header checkbox, then the trash icon. Permanent. [TF] | One, several, or one page of up to 50. Not every response at once. Trash for 90 days. [TY] [TYt] | One response from Individual. Cannot be undone. "Download and delete" for the 2026 cap has no steps. [GFd] [GF] | Delete or archive the filtered entries. [JFf] | unverified. Deleted submissions leave the monthly count. [FO] | Selection column, then delete in chunks of 5. [FBsrc `ResponseTableColumns.tsx`, `selected-row-settings.tsx`] | A select checkbox exists and is off (`visibleIndex: -1`). No delete. [SJs `rowextensions.ts`] | UI delete icons. API: one submission, or the whole form if `x-delete-confirm` equals the form id. [IOd] [IOs `deleteSubmissionHandler.js`] |
| Bulk export | Selected rows, or all, as XLSX or CSV. An interaction, not a format survey. [TF] | Partial tab: CSV. Export of completed submissions not in the pages read. [TYp] | Download responses (.csv). Linked Sheet is the live copy. [GF] [GFd] | Excel, CSV or PDF. [JFv] | CSV of the filtered set. [FO] | All, filtered, or selected rows, CSV or Excel. [FBd] | CSV by default. XLSX and PDF if those libraries are loaded. Downloads every loaded row. [SJs `tabulator.ts`] | Export JSON and Export CSV of the whole form, streamed from the database. [IOd] |
| Edit a response as admin | Not in the responses article. unverified | unverified | Not documented. [GF] [GFd] | Inline edit, which does not fire integrations. Or Edit Entry, which resubmits and does. [JFe] | API `includeEditLink` adds `editLink`. Admin editing in Results is not in the article. unverified | `PUT /management/responses/{id}` exists. The card updates tags and deletes; it does not edit answers. [FBsrc `openapi.ts`, `SingleResponseCard`] | No. [SJs] | Edit icon, and `PUT` on the submission. [IOd] [IOs `SubmissionResource.js`] |
| Comments, notes, tags, status, star | Manual tags: 30 per response, 100 unique per form. Response type Completed or Partial. Comments and star not in the article. [TF] [TFp] | Completed versus partial. Tags, star and comments unverified. [TYp] [TYa] | None of these. [GF] [GFd] | Unread, read, starred, unstarred, and tags. [JFf] | Comments, with edit and delete. Approval workflows have status and notes. Star applies to forms, not responses. [FOc] [FOn] | Tags, and a status of completed or abandoned. No comments or star in these files. [FBd] [FBsrc `ResponseTableColumns.tsx`] | No. [SJs] | A `deleted` flag, not a workflow status. No tags in these files. [IOs `deleteSubmissionHandler.js`] |
| Assign to a teammate | Not in the article. [TF] | unverified | No. [GF] | "Respond to or forward" is mentioned. An assignee field is not. [JFv] | Typing `@` notifies that teammate by email. No assignee field. [FOc] | No, in these files. [FBsrc card and table] | No. [SJs] | Submission access grants, which are permissions, not an assignment. [IOs `SubmissionResource.js`] |
| Notifications of new responses | The list API can omit the last 30 minutes and says to use webhooks. Partial webhooks are a form setting. An in-app badge is not in the article. [TFg] [TFp] | Partials do not send email. Completed-submission email unverified. [TYp] | "Get email notifications for new responses." [GF] | Sample form payload includes a notification email. Submissions have a `new` flag. A settings toggle was not in the articles. [JFa] | The home page shows when new, unread submissions exist. [FOn] | Creating a response through the API runs webhooks, integrations and follow-ups. An in-app badge was not in the responses page. [FBsrc `openapi.ts`] | No. [SJs] | Not in the submissions article. unverified [IOd] |
| Share a read-only response link | Not in the article. unverified [TF] | `previewUrl` and `pdfUrl` are signed and do not expire. Not described as a share control. [TYa] | Collaborators on the form, and separately on the sheet. No public response link. [GF] [GFd] | Not documented. A reader asked for a read-only filtered link; the article does not add one. [JFf] | A magic link to a form or its results. A form can be shared read or write. A link to one response is not described. [FOn] | `isReadOnly` hides delete and row selection. No link generator in these files. [FBsrc `ResponseTableColumns.tsx`] | `isPublic` on a column, reported to the host. No link. [SJs `columnextensions.ts`] | A temporary token scoped to one submission's PDF, with `x-expire`. [IOd] |
| Include partial responses | Plan-gated. Basic and Plus: 1 Partial Submit Point. Business and above: up to 3. Growth and Enterprise: after every question. Filter by response type. [TFp] [TF] | Plan-gated: Pro. Shown in Submissions, not in Summary. [TYp] | Not in these articles. unverified [GF] [GFd] | Not in the article body. unverified [JFv] [JFf] | Plan-gated: the partials view is Business, Team and Enterprise. Partials do not count toward the monthly limit. [FO] | Status column and a filter of all, complete or partial. A partial cannot be deleted until 5 minutes after `updatedAt`. [FBd] [FBsrc `SingleResponseCardHeader.tsx`] | No partial state. [SJs] | Not in these files. unverified [IOd] [IOs] |
| Metadata: time, device, location, UTM, source, hidden fields | Start and submit time (local on screen, UTC in export). Network ID, not the IP. Hidden fields, variables, scores, ending. API metadata: browser, platform, referer, user agent, network id. Location and UTM not in these pages. [TF] [TFg] | `submittedAt`. Each answer has `respondentId`. Device, location and UTM are not in the list schema. [TYa] | Timestamp, with the CSV-sort caveat above 10,000. Email if collected. Device, location and UTM not documented. [GF] | API: `ip`, `created_at`, `updated_at`, `status`, `new`. Which of those are columns was not in the articles. [JFa] | `submissionTime`, `lastUpdatedAt`, URL parameters, and `login.email` when a login page is used. Device, location and UTM not in the schema. [FOa] | Docs: source, URL, browser, OS, device, country, hidden fields, person or Anonymous. The stored meta also has UTM, referrer, timezone, locale, screen and IP. [FBd] [FBsrc `packages/types/responses.ts` `ZResponseMeta`] | No metadata of its own. Cells are the survey's display values. [SJs `table.ts` `processLoadedDataItem`] | The stored document, minus `deleted`, `__v` and `machineName`. Device and UTM fields are not listed. [IOs `SubmissionResource.js`] |

## 2. A response against a form that has changed

**Typeform** says adding a question does not lose data, and deleting a question or an answer option loses the results for it. Export first. [TF] The article does not say what a reorder, a relabel, or an option-value change does. In the API, a choice answer is returned as a `label` on `choice` or `choices`, next to the field `id`, `ref` and `type`. The sample has no separate option value. [TFg] Whether a later relabel rewrites that stored label is unverified.

**Tally's** list payload includes the form's questions with `isDeleted`, `title` and `id`, and a submission lists only questions that were answered. [TYa] So a deleted question can still appear in `questions`. What the Submissions screen does with a renamed, reordered or deleted question is unverified. The UI articles do not mention it. [TY] [TYp]

**Google Forms** does not say, in the two help articles, what happens to existing responses when a question is edited, deleted, reordered or has its options changed. [GF] [GFd] The `FormResponse` schema was not fetched, so whether an answer snapshots the question text is unverified.

**Jotform's** sample submission stores, per answer, `text` (in the sample, "Name" and "Your Message"), `type`, `answer` and `prettyFormat`. [JFa] The page does not say whether `text` is frozen at submission or read from the current form. Reorder and deleted questions are not discussed. [JFv] [JFe]

**Fillout's** API returns each answer with `id`, `name` ("the question text"), `type` and `value`. [FOa] It does not say whether `name` is historical. A changelog line says past submissions from deleted pages now show on the results tab. [FOn] That sentence is about pages, not about a deleted or relabelled question. Those cases are unverified.

**Formbricks** builds the table columns from `getElementsFromBlocks(survey.blocks)` and the headlines from those current elements. [FBsrc `ResponseTableColumns.tsx`, `getElementColumnsData` and the `elements` assignment] Answers are read from `responseData` by element id. The response type has `surveyId` and `data`, and no form-version id. [FBsrc `packages/types/responses.ts` `ZResponse`] The single card decides which questions were skipped by walking the current `survey.blocks`. [FBsrc `SingleResponseCard/index.tsx` `skippedQuestions`] A question removed from the current blocks therefore has no column and is not walked as a skipped question. Whether the answer key remains in `data` with nowhere to render it was not tested. There is no version indicator on the row in this code.

**SurveyJS** builds columns from `survey.getAllQuestions()`. [SJs `src/tables/table.ts` `buildColumns`] Each cell is the question's `displayValue` after the row is loaded into the survey model. [SJs `table.ts` `processLoadedDataItem`] A question that is no longer in the model has no column. The package has no form version and no orphaned-answer indicator.

**Form.io** shows, in the Data tab, the fields whose Table View checkbox is on. That checkbox is edited on the current form. [IOd] Submission data is stored as JSON, which is why JSON export is described as the truest copy. [IOd] The help page does not say whether a key left behind by a deleted component still appears. That is unverified.

## 3. List and query APIs

Rate limits are included only where the page or the source states one. The others are unverified, and named in §6.

### Typeform

`GET https://api.typeform.com/forms/{form_id}/responses`. [TFg]

> If your typeform has more than 1000 responses, use the `since`/`until` or `before`/`after` query parameters to narrow the scope of your request.

`since` and `until` are inclusive, as Unix seconds or UTC `YYYY-MM-DDTHH:MM:SS`. `before` and `after` are exclusive cursors. Also `included_response_ids`, `excluded_response_ids`, `response_type` (`partial`, `completed`; default `completed`), `sort` (default `submitted_at,desc` for completed), `query` (an exact phrase across answers, hidden fields and variables), `fields` (which answers to return; missing ones are `null`) and a parameter that keeps only responses answering one of the given fields. [TFg] The rendered parameter name for that last one did not survive the fetch; the description did. Choice answers come back as labels. [TFg]

> Very recent responses (say within the last 30 minutes) may not be returned. Consider using Typeform webhooks instead.

`POST https://api.typeform.com/forms/{form_id}/responses/search` is the answer-filter endpoint. [TFs] A `filter_group` is AND. A filter `field` is `response_id`, `timestamp`, `tags`, `answers.{field_id}`, `metadata.{key}` or `hidden.{key}`. Operators: `equals` (text, number or boolean), `any_of` (a `text_list`), `interval` (inclusive Unix seconds, either bound optional), and `contains` is listed among the valid values. `size` defaults to 25 and the maximum is 1000. Sort clauses cannot be combined with `after_response_id` or `before_response_id`. `response_type` defaults to `["completed"]`. [TFs]

The rate-limit page at `developers/get-started/rate-limits/` returned 404. The limit is unverified.

### Tally

`GET https://api.tally.so/forms/{formId}/submissions`, bearer auth. [TYa]

| Query | Contract |
|---|---|
| `page` | Integer, minimum 1, default 1. |
| `limit` | Integer, 1 to 500, default 50. |
| `filter` | `all`, `completed` or `partial`. |
| `startDate`, `endDate` | ISO 8601, inclusive. |
| `afterId` | Submissions after that id. |

The body has `page`, `limit`, `hasMore`, counts per filter, `questions` (`isDeleted` among the fields) and `submissions`. A submission has `id`, `isCompleted`, `submittedAt`, `previewUrl`, `pdfUrl` ("Includes an access token, no expiry") and `responses`. Only answered questions appear. There is no sort parameter, no field selection and no per-answer operator. [TYa] No rate limit on this page.

### Google Forms

`GET https://forms.googleapis.com/v1/forms/{formId}/responses`. [GFa]

> Currently, the only supported filters are: `timestamp > N` … and `timestamp >= N` … RFC3339 UTC.

`pageSize` defaults, when omitted or zero, to at most 5000. `pageToken` must be reused with the same form and the same filter. The response is `responses` plus `nextPageToken`. List items omit `formId`. Scopes: `drive`, `drive.file`, or `forms.responses.readonly`. [GFa] No sort parameter and no field mask on this method. The API quota page timed out, so the quota is unverified. The product limits in §1 are help-centre limits, not API quotas. [GF]

### Jotform

`GET https://api.jotform.com/form/{formID}/submissions`, also `/user/submissions`. EU and HIPAA hosts are `eu-api.jotform.com` and `hipaa-api.jotform.com`. Auth is `apiKey` in the query or an `APIKEY` header. [JFa] [JFp]

The docs page says `offset` is the start of the page, `limit` the page size, `orderby` a submission field name, and `filter` a range. The sample `resultSet` is `offset` 0, `limit` 100, `orderby` `"id"`, `filter` `{"new":"1"}`. [JFa] The PHP client JSON-encodes `filter` and passes the four parameters through. [JFp] Comparison operators such as `created_at:gt` are not on the page that was fetched, so the operator grammar is unverified. No maximum `limit` is stated. A submission in the sample includes `ip`, `created_at`, `updated_at`, `status`, `new` and `answers` keyed by question id, each with `text`, `type`, `answer` and `prettyFormat`. [JFa]

Daily API calls: 1,000 starter, 10,000 bronze, 50,000 silver, 100,000 gold, unlimited on Enterprise. The response includes `limit-left`. [JFa]

### Fillout

`GET https://api.fillout.com/v1/api/forms/{formId}/submissions`, and `https://eu-api.fillout.com/v1/api` for the EU server. Bearer API key. [FOa]

| Query | Contract |
|---|---|
| `limit` | 1 to 150, default 50. |
| `offset` | Default 0. |
| `afterDate`, `beforeDate` | Date-time. |
| `status` | `finished` (default) or `in_progress`. |
| `sort` | `asc` (default) or `desc`. |
| `search` | Submissions containing the string. |
| `includeEditLink` | Adds `editLink`. |
| `includePreview` | Includes preview responses. |

The body is `responses`, `totalResponses` and `pageCount`. Each question is `id`, `name`, `type`, `value`. URL parameters, calculations, quiz, login, payments and scheduling are separate arrays. [FOa] No per-question operator and no field selection. No rate limit on this page. A changelog line announces a delete endpoint. [FOn] Its path and body were not read.

### Formbricks

Two list contracts. The published docs are v2. v3 was read from the repository at [FBsrc], not from the public docs site.

**v2.** `GET https://app.formbricks.com/api/v2/management/responses`, header `x-api-key`. [FBv2]

| Query | Contract |
|---|---|
| `limit` | 1 to 250, default 50. |
| `skip` | Minimum 0, default 0. |
| `sortBy` | `createdAt` (default) or `updatedAt`. |
| `order` | `asc` or `desc`, default `desc`. |
| `startDate`, `endDate` | With `filterDateField` of `createdAt` or `updatedAt`. |
| `surveyId`, `contactId` | Optional. |

`meta` returns `total`, `limit` and `offset`. The response object includes `finished`, `data`, `variables`, `ttc`, `meta` and `contactAttributes`. This endpoint has no answer filter. [FBv2] Source rate limit for v2: 100 requests per minute. [FBsrc `apps/web/modules/core/rate-limit/rate-limit-configs.ts`, `api.v2`]

**v3**, from `docs/api-v3-reference/src/paths/api_v3_responses.yml`. `GET` list, newest first, keyset on `(createdAt, id)`.

> The `cursor` is opaque and bound to the sort order and the filter set it was issued for; changing either invalidates it. `meta.nextCursor` being `null` is the only end-of-collection signal.

`limit` is 1 to 250, default 20; a larger value is a 400, not a silent clamp (`LimitQuery.yml`). `sortBy` is `-createdAt` (default) or `createdAt`. `updatedAt` is refused as a sort because it is mutable and unindexed. Filters that are allowed: `surveyId`, `contactId`, `filter[createdAt]` bounds, `filter[finished][eq]`, `filter[language][in]`, `filter[id][in]` (at most 100). `finished` and `language` require `surveyId` or `contactId`, or the call is 400.

> What this endpoint deliberately does not filter on: individual answers, hidden-field values, submission metadata (`source`, `url`, `country`, `browser`, `os`, `deviceType`), contact attributes, quotas, and tags. … The in-app dashboard does offer these, so this endpoint is knowingly behind it.

`includeTotalCount` defaults to false. When true, the count stops at 10,000 and `totalCountRelation` is `eq` or `gte`. Same 100-per-minute bucket, `api.v3`. [FBsrc rate-limit config]

`POST` batch delete, a separate path, deletes up to 100 ids in one transaction and ignores ids outside the workspace. [FBsrc `api_v3_responses_batch-delete.yml`]

### SurveyJS

There is no list API. The host passes an array, or a function called with `offset`, `limit`, `filter` and `sort`. [SJs `tabulator.ts`, the `ajaxRequestFunc` branch] `filter` is Tabulator's filter list. `sort` is `{ field, direction }`. The callback returns `{ data, totalCount }`, and the table computes `last_page` as `ceil(totalCount / pageSize)`. Local mode holds every row in memory. [SJs `tabulator.ts`]

### Form.io

The submission resource is mounted at `/form/:formId/submission`. [IOs `src/resources/SubmissionResource.js`, the `MySubmissionResource` constructor] resourcejs then registers `GET` on that path for the index and `GET` on `/form/:formId/submission/:submissionId` for one record. [RJS `index` and the following `get`, around the `_register` calls]

Index query parameters, from resourcejs 2.6.1: `limit`, `skip`, `select`, `sort`, `populate`, and any other query key. A key `name__selector` becomes a Mongo operator. The selectors with special cases are `regex`, `exists`, and `in` / `nin` / `all` (comma-separated or repeated). Any other selector is written as `$selector`. [RJS `getFindQuery`] `eq` and `ne` coerce the strings `null`, `true` and `false`. Date-typed paths are parsed with moment. [RJS `getQueryValue`] Default `limit` is 10 and `skip` is 0. A negative or non-numeric limit falls back to 10. There is no upper bound in this function. [RJS `index`, the `defaults` and `parseInt` block] `select` and `sort` are space- or comma-separated field lists. A `Range: items=` header can also set the window. [RJS]

Form.io coerces index filters before that runs: number components become numbers and checkbox components become booleans, under the `data.` prefix. [IOs `src/middleware/setFilterQueryTypes.js`] The index also forces `deleted` to null and applies owner and submission-access filters. [IOs `SubmissionResource.js` `beforeIndex`] `list` and `full` are stripped so they are not treated as filters. Hidden from responses: `deleted`, `__v`, `machineName`. [IOs `SubmissionResource.js`]

No rate limit was found in these files.

## 4. Privacy and admin safety

**Typeform.** Delete is permanent: "you cannot recover deleted responses." [TF] The same article says the Network ID is generated from the IP and the IP is not stored. It also says that after a paid plan is cancelled, access to response data is limited; the details are on another page that was not read. No anonymisation, audit log, retention schedule or erasure-request flow is in the responses article.

**Tally.** Deleted forms, workspaces and submissions go to Trash for 90 days, then they are removed. Emptying Trash removes them immediately. [TYt] A form can auto-delete submissions after a custom period, "from minutes up to years", and those submissions then sit in Trash for the same 90 days. [TYt] Delete in the UI is one response, a selection, or one page of 50, not the whole set. [TY] No anonymisation, audit log or delete-by-respondent is in these pages.

**Google Forms.** Deleting one response cannot be undone. [GFd] Deleting responses does not delete attached files. [GF] Deleting the form does not delete a linked spreadsheet, and the reverse is also true. [GFd] A collaborator removed from the form still has the sheet until removed there too. [GF] [GFd] No anonymisation, audit log, retention schedule or erasure API is in these pages. The list scope `forms.responses.readonly` is read-only. [GFa]

**Jotform.** Filtered entries can be downloaded, deleted or archived. [JFf] The sample submission includes the respondent IP. [JFa] A sub-user's `access_type` is `full` or `readOnly`; `readOnly` "means form cannot be changed by the sub-user. Only submissions can be viewed." [JFa, the sub-user section of the same docs page] `getHistory` records form creation, update, delete and account logins, not reads of submissions. [JFp, the `getHistory` comment] HIPAA has its own API host. [JFa] A retention setting and an erasure-request tool were not in the articles read.

**Fillout.** "Deleted submissions no longer appear in your form's analytics or in your monthly count." [FO] No trash, anonymisation or audit log is in the Results or comments articles. Sharing is a magic link to the form or its results, or a read or write share of the form. [FOn] The delete API's contract was not read. [FOn]

**Formbricks.** The card deletes one response, and refuses to delete an unfinished one until five minutes after `updatedAt`. [FBsrc `SingleResponseCardHeader.tsx` `canResponseBeDeleted`] Selected rows are deleted five at a time, with an option to decrement quotas. [FBsrc `selected-row-settings.tsx`, `CHUNK_SIZE = 5`] v3 batch delete removes up to 100, requires `manage`, and also queues deletion of uploaded files. [FBsrc `api_v3_responses_batch-delete.yml`] `isReadOnly` removes the selection column and the delete button. [FBsrc `ResponseTableColumns.tsx`, the `isReadOnly` return] The rate-limit config names an internal retention export and caps it at 10 per hour. [FBsrc `rate-limit-configs.ts` `internalRetentionExport`] What that retention policy stores was not read. No anonymisation path was found in the response files that were read.

**SurveyJS.** No persistence, so no delete, audit, retention or erasure. The `isPublic` flag on a column is handed to `onPermissionsChangedCallback` for the host to enforce. [SJs `columnextensions.ts` `makepublic`] The table renders a commercial-license link when `haveCommercialLicense` is false. [SJs `table.ts` `render`]

**Form.io.** Delete flags the submission (`deleted`) instead of removing it, and the index hides flagged rows. [IOs `deleteSubmissionHandler.js`, `SubmissionResource.js` `filterMongooseExists`] Deleting every submission of a form requires the header `x-delete-confirm` to equal the form id; without it the response is 400 "No confirmation header provided". [IOs `deleteSubmissionHandler.js`] Every verb runs `permissionHandler`, and field filtering runs through `filterProtectedFields`. [IOs `SubmissionResource.js`] A PDF download uses a temporary token whose `x-allow` is one project, form and submission, and whose `x-expire` in the documented example is 3600 seconds. [IOd] No anonymisation or retention schedule is in these files.

## 5. What this means for Formidabile

Formidabile already has a list and a detail, and they are deliberately smaller than the tables above. `GET /responses` takes optional `formId`, `versionId`, `refNamespace` with `refId`, `respondentId`, `cursor` and `limit` (1 to 200, default 50), newest first, keyset on `id`. [ADR 0013; `api.ts` `ResponseListQuery`] The summary has no answers. `GET /responses/{responseId}` returns the answers and embeds the version they belong to. [ticket 35] The builder filters by version, respondent and reference, pages with Load more, and renders the detail from that embedded version through `interpretAnswers`. [ticket 38] Deletes are one response, or every response by one respondent in the tenant, and only with `responses:delete`. [ADR 0013; ticket 38] There are no partial responses. [ADR 0002] Export is not in the MVP. [ADR 0002] Analytics have no filters; the response list is where version, reference and respondent are filtered. [ADR 0009]

### A table across versions

The products that document this at all do it in two ways, and neither is a versioned snapshot.

- Typeform tells the admin that deleting a question deletes its results, so the view is the form as it stands. [TF]
- Formbricks and SurveyJS build columns from the current question list. An answer whose question is gone has no column. [FBsrc `ResponseTableColumns.tsx`; SJs `table.ts` `buildColumns`]
- Tally's list payload can still carry a question with `isDeleted: true`. [TYa] That is the closest thing to an orphan column, and it is on the API, not in the UI article.
- Jotform and Fillout return a question label on each answer (`text`, `name`). [JFa] [FOa] Neither page says the label is frozen, so it cannot be treated as a snapshot.

Formidabile already refuses the current-form approach. A read returns the version the response was submitted under, and the builder renders that. [ticket 35; ticket 38; ADR 0005] Answers are keyed by question identity, and a choice is stored as its option value, not its label. [ADR 0005; ADR 0001 §4.6, labels and values] So a detail view does not drift when a later version relabels, reorders, drops a question or changes an option's label.

A table is a different shape. Columns taken from the current version repeat the Formbricks and SurveyJS behaviour: dropped questions vanish, and a relabelled option would show the new label on an old row if the cell used the current snapshot. Columns taken from one selected version do the same for every other version. The union that matches the module's own rule is the set of question identities, which is what analytics already walks: current questions in current order, then dropped ones. [ticket 40, the analytics comment on question order] A cell then has to be interpreted with that row's version. The identity's type does not change. [ADR 0005] The label, the option labels and the constraints do. [ADR 0009] Showing the option value, or the label from the row's own version, is the difference between a stable column and a column that rewrites history. None of the products document that distinction. Typeform's API returns the choice label and no value. [TFg]

The list endpoint cannot feed that table. A summary has no answers, so a host would read every row, or the module would add a projection. [ticket 35] `limit` is at most 200, so a Typeform-style grid of thousands of responses is many requests. [TF, the warning about thousands; `api.ts` `listLimit`]

### Filtering the seven types

The in-app filters that actually name operators are Typeform and Formbricks. Typeform's UI filters choice questions, OR within one question, and its search API adds `equals`, `any_of`, `interval` and phrase `contains`, keyed by field id. [TF] [TFs] Formbricks' schema covers equality, numeric and date comparisons, `contains` and its variants, and `includesOne` / `includesAll` for multi-value answers, keyed by element id. The v3 API then refuses to expose any of that, because an answer filter is a JSON path on the largest table. [FBsrc `packages/types/responses.ts` `ZResponseFilterCriteria`; `api_v3_responses.yml`] Form.io goes the other way and accepts Mongo operators on `data.*`. [RJS]

Formidabile stores answers as rows, not as one JSON document, so an equality or comparison is a condition on those rows rather than a scan of a document. [ADR 0007] The list does not offer it. Filters are form, version, reference and respondent. [ADR 0009; `api.ts` `ResponseListQuery`] The seven types, and the operators the other products actually use, line up as follows. Text and email: equality or `contains`. [TFs; FBsrc schema] Number: comparisons. [FBsrc schema `lessThan` and the siblings] Date: a range. [FBsrc schema `inRange`; TFs `interval`] Single choice: equality on the option value. Multiple choice: overlap, which is Typeform's OR and Formbricks' `includesOne`. [TF; FBsrc schema] Boolean: equality. Filtering on the label would break the rule that a relabel does not change the answer. [ADR 0001 §4.6]

### Pagination on append-mostly rows

Offset is what Jotform, Fillout, Formbricks v2, Tally's `page` and Form.io's `skip` use. [JFa] [FOa] [FBv2] [TYa] [RJS] Formbricks v3 explains why it moved off offset: the cursor is bound to the sort and the filter, a short page is not the end, and `updatedAt` cannot anchor a cursor because it changes. [FBsrc `api_v3_responses.yml`] Inserts and deletes shift an offset page. Edits that do not move the sort key do not.

Formidabile's sort key is `id`, newest first, and the next page is `id` less than the cursor. [ticket 35] `id` and `submitted_at` are fixed columns. [ticket 19, the trigger argument list] An edit changes answers, `revision` and `edited_at`, so it does not move a row between pages. Ticket 35 tests that. A hard delete removes the row. A later page does not skip or repeat, because the cursor is an id rather than an offset. The same property is why v3 uses `(createdAt, id)` and why a client-chosen id was rejected as the response id. [FBsrc v3 yaml; ADR 0016]

Two limits follow from the other products. Google hides the individual view above 10,000 responses and the summary above 50,000, and stops the Sheets sync above 100,000. [GF] Typeform says thousands of rows are slow and points the admin at export or webhooks. [TF] Formidabile's advisory envelope is 10,000 responses per form, and it is not enforced. [ADR 0015] A table that loads answers for each of 200 rows, then again for the next page, is the cost side of keeping answers out of the summary.

### Respondent, anonymous, and references as columns

The metadata columns in Typeform, Formbricks and Jotform (network id, browser, IP, UTM, country) exist because those products store them. [TF] [TFg] [FBd] [JFa] Formidabile does not collect device, location or UTM. The personal data it does store is the subject, the answers, the references and the timestamps. [ADR 0013] A metadata column set copied from Formbricks would be new collection, not a view over current rows.

What the list can already show is `respondentId` (null when anonymous), `submittedAt`, `editedAt`, `versionNumber` and `externalRefs`. [ticket 35] The subject is a pseudonym. The host maps it to a person. [ADR 0013] Filtering by `respondentId` with no `formId` lists that respondent across the tenant. [ticket 35] There is no parameter for "anonymous only". Omitting `respondentId` lists everyone. [api.ts `ResponseListQuery`]

References are host-signed and fixed at submit. [ADR 012] The list filters one namespace plus one id, both or neither. [api.ts `refHalvesTogether`] That is the same idea as Typeform's hidden fields and Formbricks' hidden fields, with the difference that the respondent cannot set them. [TF; FBd; ADR 0012] A column of references is a display of data the summary already returns. A filter beyond a single pair, or a free-text search over reference ids, is not on the endpoint.

### Where the module's view stops

Google's own answer to a large or awkward response set is a linked spreadsheet, with permissions that do not follow the form. [GF] [GFd] Formbricks keeps the rich filters in the app and ships a list API that refuses them. [FBsrc v3 yaml] ADR 0009 leaves host-specific reporting to integration interfaces, and ADR 0010 makes the reference lookup an admin call from the host's backend.

The current HTTP API is enough for the view the builder has: a filtered, keyset-paged list of summaries, a detail reconstructed from the embedded version, and the two deletes. [ticket 38; ADR 0013] It is not enough, without one read per row, for an answer table, an answer filter, a search box, or an export of a selection. Those are the features the tables in §1 are built out of. Adding them in the module, or leaving them to a host that reads the API and builds its own grid, is the boundary. The host already has to do that for anything that depends on its own entities, because the module will not learn them. [ADR 0009; ADR 0010]

### Hard deletion

Typeform deletes permanently. [TF] Tally keeps a 90-day trash and a per-form retention period. [TYt] Google's single-response delete cannot be undone, and it leaves uploaded files. [GFd] [GF] Form.io soft-deletes. [IOs `deleteSubmissionHandler.js`] Formbricks hard-deletes, protects an in-progress response for five minutes, and deletes selected rows in small chunks. [FBsrc card header; `selected-row-settings.tsx`]

Formidabile's erasure is the hard delete of one response, or of every response by one respondent in the tenant. There is no trash, no anonymisation and no retention schedule. The host owns retention and calls the delete endpoints. [ADR 0013; ADR 0002] Anonymous responses have no respondent id, so they are deleted by id, found through the reference filter. [ADR 0013] The builder already puts both deletes behind a confirmation and behind `responses:delete`. [ticket 38]

A bulk delete of "the rows I selected" or "the rows matching this filter" is what Typeform, Tally, Jotform and Formbricks offer. [TF] [TY] [JFf] [FBsrc `selected-row-settings.tsx`] The module can delete one id, or every response of one subject. It cannot delete an arbitrary set in one call. A selected-row delete in the builder would be a loop of `DELETE /responses/{id}`, which is the Formbricks pattern of one call per id. [FBsrc `selected-row-settings.tsx`] A filter-scoped delete does not exist, and a collection-level delete is the accident Formbricks v3 refuses by using a separate batch path. [FBsrc `api_v3_responses_batch-delete.yml`]

Nothing in the module writes an audit record of a read or a delete. Jotform's history endpoint is the only audited activity log in this set, and it does not record response reads. [JFp] Logs here must not contain answers, references or tokens. [ADR 0013]

### Open questions for the owner

1. Is the next response view still a summary list plus a version-faithful detail, or an answer table? A table needs a column identity (question identity, not position) and a rule for the cell label.
2. If it is a table, are dropped questions their own columns, as analytics already orders them, or hidden until the admin asks?
3. Do answer filters belong on `GET /responses`, or only in a host-built view? Per type, the operators other products ship are equality, `contains`, numeric comparison, date range, and overlap for multiple choice, all on the option value rather than the label.
4. Should the list grow an anonymous-only filter, and a way to select which summary fields come back, or is one read per detail acceptable?
5. Is bulk delete a loop of single deletes, a batch with an explicit id list, or out of scope? A delete-by-filter is a different operation from delete-by-respondent.
6. Tags, status, star, comments and assignment are product workflow. The module has none of them. Do they stay with the host?
7. Notifications. The products that document them use email or webhooks, not a poll of the list. Typeform's list can be 30 minutes behind. [TFg] The module currently has no submission event. Is that still the host's job?
8. A shared read-only link. Fillout uses a magic link to the results, Form.io a short-lived token scoped to one submission. [FOn] [IOd] Given host-signed tokens, is a share link a host concern?
9. Partial responses stay out. [ADR 0002] Several products gate them by plan and keep them out of aggregate numbers. [TFp] [TYp] [FO] Confirm that the view does not grow a status column for them.

## 6. Could not verify

- Typeform's API rate limit. The documented URL returned 404.
- Whether Typeform stores a choice's label at submission time or resolves it later. The API returns a label. [TFg] The help article does not say.
- Typeform: admin edit of an answer, comments, assignment, an in-app new-response badge, saved filter views, per-column sort, and a shareable response link.
- Tally's Submissions screen beyond delete, partials and trash: column controls, sort, answer filters, search, saved views, opening one response, editing, tags, metadata columns, and email on a completed submission.
- Tally's API rate limit, and any export of completed submissions. Partial CSV is documented. [TYp]
- Google Forms: the question view, other than that it disappears above 10,000 responses. [GF] What an edited or deleted question does to old responses. API quotas (the quota page timed out). Filters, search, column controls, partials, and admin edit.
- Whether Google's "download and delete" for the 2026 cap deletes in bulk. Only the one-response delete has steps. [GF] [GFd]
- Jotform: the `filter` operator grammar, the maximum `limit`, UI pagination, per-column sort, column show/hide/reorder/resize, incomplete submissions, and a read-only share link.
- Whether Jotform's per-answer `text` is frozen. [JFa]
- Jotform retention settings and any erasure-request tool.
- Fillout: the admin edit UI, bulk delete, column resize, per-question filter operators, and the delete API's path and body.
- What Fillout does with a renamed or deleted question. Deleted pages are documented. [FOn]
- Fillout's API rate limit, and device, location and UTM metadata.
- Formbricks: which plan `isQuotasAllowed` corresponds to. The retention policy named in the rate-limit config. Whether a removed element's answer is still visible anywhere.
- Form.io: whether the Data tab shows JSON keys whose component was deleted. UI sort, search and date filters. Partials. Rate limits. The difference between `resourcejs` 2.6.1, which was read, and `2.6.2-dev.151.789661d`, which Form.io 4.5.0-rc.1 declares and which did not resolve.
- SurveyJS: nothing beyond the table package. It has no server and no form versions.
