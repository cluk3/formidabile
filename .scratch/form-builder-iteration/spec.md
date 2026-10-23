# Spec: Form builder iteration — pages, conditional logic, new question types, duplicate and restore

Status: ready-for-agent

The decisions behind this spec are recorded in ADR-017 (show conditions and forward jumps decide the path), ADR-018 (nine new question types, and what makes something a question type) and ADR-019 (duplicate and restore, and form-scoped question identity), with amendment notes in ADR-002, ADR-005, ADR-009 and ADR-010. The research they rest on is indexed in this feature's `research/index.md`. If this spec and an ADR disagree, the ADR wins. Use the vocabulary in the glossary: form, form version, form definition, draft, page, condition, show condition, jump, path, skipped, question identity, question snapshot, question type, constraint, display setting, option value, row value, duplicate, restore.

## Problem Statement

Editors can only build a single scrolling list of questions from seven question types, and every respondent sees every question. Long forms can't be split into pages. A question that only matters for some respondents ("Why not?" after a "No") has to be asked of everyone, and a section that doesn't apply can't be skipped. Common question kinds that other form products offer (phone numbers, links, times, rankings, grids, addresses, star ratings, NPS, consent boxes) are missing or have to be faked with free text, which loses validation and analytics. Editors who want a form like an existing one have to rebuild it by hand, and there's no way to bring back an older version's content after a draft has gone wrong. Analysts can't tell a question a respondent skipped from one they were never meant to see.

## Solution

A form definition becomes an ordered list of pages (definition format 2). A question may carry a show condition over earlier answers, and a page may carry an ordered list of forward jumps, to a later page or to the end of the form, that run when the respondent clicks Next. One pure function in `@fb/core` decides each respondent's path, and the renderer, the server's answer validation, the response views and analytics all use it, so the browser and the server never disagree about what someone was shown. Each response records the path it was given, so analytics report answered, skipped and not shown separately.

Nine question types join the seven: phone, URL, time of day, date and time, date range, ranking, single-choice matrix, multiple-choice matrix and address. Number gains rating, scale, slider and NPS displays and a step constraint, and boolean gains a "must be yes" constraint shown as a consent checkbox.

Editors can duplicate a form from any of its versions or its draft, and restore any published version into the draft. Both are built from the existing endpoints, so any host can do the same.

## User Stories

### Pages and navigation

1. As an editor, I want to split my form into pages, so that respondents see a manageable number of questions at a time.
2. As an editor, I want to give a page an optional title and description, so that respondents know what each section is about.
3. As an editor, I want untitled pages labelled "Page N" in the builder, so that I can tell them apart without inventing titles respondents will see.
4. As an editor, I want to reorder pages and move a question to another page, so that I can restructure a form without recreating questions.
5. As an editor, I want moving a question between pages to keep its question identity, so that its answers keep combining across versions.
6. As an editor, I want publish to refuse an empty page, so that respondents never land on a page with nothing on it.
7. As an editor, I want an existing single-list form to open as one page, so that nothing about it changes until I add a page.
8. As a respondent, I want to see one page at a time with a Next button, so that a long form feels shorter.
9. As a respondent, I want the button to read "Submit" when my answers end the form on this page, and "Next" otherwise, updating as I answer, so that I always know what clicking it will do.
10. As a respondent, I want Next to check only the questions on this page that I'm being asked, so that I fix problems where they are.
11. As a respondent, I want a failed Next to list the problems and move focus to the first invalid field, so that I can fix them with a keyboard or screen reader.
12. As a respondent, I want Back to return me through the pages I actually visited, so that I can review and change earlier answers.
13. As a respondent, I want focus to move to the new page's heading when the page changes, so that a screen reader announces where I am and the page scrolls to it.
14. As a respondent, I want pages whose questions are all hidden for me to be passed over, so that I never see a page with nothing to answer.
15. As a respondent, I want no misleading "page X of Y", so that a count that changes with my answers doesn't confuse me.
16. As a respondent editing my submitted response, I want to walk the pages again from the first, with my answers filled in, so that jumps reflect what I change.

### Show conditions

17. As an editor, I want to give a question a show condition based on earlier answers, so that only respondents it applies to are asked.
18. As an editor, I want to combine conditions with "all" and "any" and nest groups, so that I can express rules like "employed and (full-time or contractor)".
19. As an editor, I want conditions to refer to questions and options by identity, never by label or position, so that rewording or reordering never changes what a condition means.
20. As an editor, I want each question type to offer the operators that make sense for it, so that I can't write a condition that can't be evaluated.
21. As an editor, I want "is answered" and "is not answered" on every type, so that I can show follow-ups based on whether someone answered at all.
22. As an editor, I want text comparisons to ignore case, surrounding spaces and Unicode composition, so that "Yes", " yes" and "YES" match the same way for every respondent whatever their browser's language.
23. As an editor, I want a condition to only read questions earlier in the form, so that the form can never loop.
24. As a respondent, I want a question I wasn't shown to not be required of me, so that a hidden required question never blocks my submission.
25. As a respondent, I want answers I gave to a question that later became hidden to be left out of what I submit, but kept on my screen, so that changing my earlier answer back restores them.

### Jumps

26. As an editor, I want to add jumps to a page that go to a later page or to the end of the form when their condition holds, so that respondents skip sections that don't apply.
27. As an editor, I want a page's jumps to be an ordered list where the first match wins and otherwise the next page follows, so that the routing is predictable.
28. As an editor, I want a jump to be able to read questions on its own page, so that I can route on an answer given just before Next.
29. As an editor, I want "the end" to mean submit, so that ending early behaves exactly like finishing.

### Broken logic and preview

30. As an editor, I want deleting a question, removing an option, or moving a question below a condition that reads it to leave the condition in place marked broken, so that logic is never silently lost.
31. As an editor, I want a jump whose target page I deleted or moved earlier to stay in place marked broken, so that I notice and fix it.
32. As an editor, I want publish to refuse a definition with broken conditions or jumps, so that no published version contains logic that can't run.
33. As an editor, I want "treat as a new question" to update every condition that read the old identity, so that the logic follows the question.
34. As an editor, I want to preview a draft with pages and logic even while some logic is broken, so that I can try my changes before fixing everything.
35. As an editor, I want broken references treated as unanswered in preview, and broken jumps skipped, with the broken-logic warning beside the preview, so that preview never crashes and tells me what's wrong.
36. As an editor, I want a warning, never a publish block, when the builder can see that a question or page can't be reached, so that I catch obvious mistakes without the builder pretending to prove reachability.

### New question types

37. As an editor, I want a phone question that stores international numbers, so that I get comparable, dialable numbers.
38. As a respondent, I want to type a phone number with spaces, dashes, dots or parentheses, so that I can write it the way I'm used to.
39. As a respondent, I want a clear message when I leave out the country code, so that I know how to fix a local number.
40. As an editor, I want phone conditions for equals, does not equal, starts with and does not start with, so that I can route on country code.
41. As an editor, I want a URL question that accepts only http and https links, so that I don't collect javascript: links or junk.
42. As a respondent, I want `https://` added visibly when I leave out the scheme, so that I don't have to type it.
43. As an analyst, I want URL answers shown as plain text, never as clickable links, so that a respondent can't phish me through the response view.
44. As an editor, I want a time-of-day question with optional earliest and latest bounds, so that I can ask for a preferred time.
45. As an editor, I want a date-and-time question in local wall-clock time with optional bounds, so that I can ask for an appointment slot without time-zone confusion.
46. As an editor, I want a date-range question with optional bounds, so that I can ask for travel or availability dates.
47. As a respondent, I want to fill in both dates of a range or neither, with the start on or before the end, so that I can't submit half a range.
48. As an editor, I want date-range conditions on the start and end dates, so that I can route on when someone arrives or leaves.
49. As an editor, I want a ranking question with 2 to 20 options, so that respondents can order priorities.
50. As a respondent, I want to build my ranking by adding options one by one and adjusting with Move up and Move down, so that I can rank with a keyboard and my ranking is a deliberate choice.
51. As an editor, I want "ranks X in the top N" and its complement as conditions, so that I can follow up on what someone cares about.
52. As an editor, I want single-choice and multiple-choice matrix questions with rows and columns, so that I can ask several similar questions compactly.
53. As an editor, I want matrix rows to keep stable row values across versions, so that relabelling a row doesn't break analytics or conditions.
54. As an editor, I want a required matrix to need every row, and an optional one to accept any rows, so that the rule is simple and predictable.
55. As an editor, I want matrix conditions on a single row, so that I can follow up on one item.
56. As a respondent, I want a matrix to show as a grid when there's room and as stacked groups when the form is narrow, so that I can answer on a phone.
57. As an editor, I want an address question where I choose which of the six lines to show and which are required, so that I collect only what I need.
58. As a respondent, I want to pick my country from a list shown in my language, so that I don't have to type it.
59. As an editor, I want "country is any of" and "country is none of" conditions on an address, so that I can route by country.
60. As a respondent, I want my browser to offer to fill in my phone, email, URL and address, so that I type less.

### Number and boolean settings

61. As an editor, I want to show a number question as stars, a labelled scale, a slider or an NPS scale, so that I can ask for ratings without changing how the answer is stored.
62. As an editor, I want switching a number question's display to keep its question identity, so that its answers keep combining across versions.
63. As an editor, I want publish to tell me when a display's rules aren't met (whole numbers, range limits, a step for sliders), so that every display renders sensibly.
64. As an editor, I want a step constraint on any number question, so that I can accept only multiples like 0.5.
65. As a respondent, I want rating, scale and slider questions to start empty, so that I'm never recorded as choosing a value I didn't pick.
66. As a respondent, I want a "Clear answer" button on optional questions answered with radios, so that I can take back an answer I didn't mean to give.
67. As an editor, I want a "must be yes" boolean shown as a single checkbox, so that I can collect consent.
68. As an editor, I want "must be yes" to make the question required where it's shown, so that a respondent on that path can't submit without consenting.

### Duplicate and restore

69. As an editor, I want to duplicate a form from any of its published versions or its draft, so that I can start a similar form without rebuilding it.
70. As an editor, I want the duplicate to be a new, never-published form that I can still delete, so that experimenting costs nothing.
71. As an editor, I want the duplicate's title to end in " (copy)", so that I can tell it from the original.
72. As an editor, I want the duplicate to keep its logic working, so that I don't have to rebuild conditions and jumps.
73. As an editor, I want the duplicate to start without the original's external references, availability or response limit, so that it doesn't claim the original's place in the host.
74. As an analyst, I want a duplicate to share no analytics with its original, so that two forms' answers are never mixed.
75. As an editor, I want to restore any published version of a form into its draft, so that I can recover from a draft that went wrong.
76. As an editor, I want to be asked before a restore replaces my draft, and to be told if someone saved in the meantime, so that I don't lose someone's work.
77. As an editor, I want restoring the current version to be how I throw away draft changes while keeping a draft open, so that I don't have to discard and start again.
78. As a host developer, I want duplicate and restore to be plain calls to the existing endpoints, so that my own admin UI can offer them.
79. As a host developer, I want to post a template definition I keep as a new form in any tenant my token names, so that I can offer templates without the module storing them.

### Responses and analytics

80. As an analyst, I want a response's detail to show each question as answered, skipped or not shown, so that I can tell what the respondent saw.
81. As an analyst, I want each question's analytics to report answered, skipped and not shown counts, so that hidden questions don't look like ignored ones.
82. As an analyst, I want respondents who weren't shown a question left out of its shares, so that conditional questions aren't diluted.
83. As an analyst, I want what a respondent was shown to stay as it was recorded at submission or edit, so that later fixes never rewrite history.
84. As an analyst, I want ranking analytics to show each option's mean position and first-place count, so that I can see priorities at a glance.
85. As an analyst, I want matrix analytics to show counts and shares for each row and column, so that I can compare items.
86. As an analyst, I want an NPS score (promoters minus detractors) for NPS questions, per version and combined across versions that used the NPS display, so that I get the standard figure.
87. As an analyst, I want rating, scale and slider questions summarised like any number question, so that I get min, max, mean and median.
88. As an analyst, I want responses collected before this iteration to show every question in their version as shown, so that old data reads exactly as it did.

### Host and custom-renderer contract

89. As a host developer, I want a `pagechange` event with the page id and title, so that I can update my page title or history if I want to.
90. As a host developer, I want the element never to touch my document title, history or URL, so that it can't interfere with my page or router.
91. As a custom-renderer author, I want the path function exported from `@fb/core`, so that my renderer behaves exactly like the server.
92. As a custom-renderer author, I want a submission containing an answer off the path to be refused with 422, so that a stale or tampered client fails loudly.
93. As a custom-renderer author, I want the advisory answer schema to mark a question required only when it's required on every path, and to carry what JSON Schema can't express as `x-fb-*` keys, so that a generic validator doesn't reject valid submissions.
94. As a custom-renderer author, I want the major `info.version` bump to tell me my renderer must handle pages, conditions and the new types, so that I don't ship a renderer that gets submissions rejected.
95. As a host developer, I want the renderer to keep working under my strict CSP with every new input, so that adopting this iteration doesn't weaken my security policy.

## Implementation Decisions

### Definition format 2 (`@fb/core/definition`)

- A format-2 definition holds a title, an optional description and an ordered, non-empty list of pages. Each page has an id (unique within the definition; the builder mints a UUID), an optional title and description, an ordered list of question snapshots, and an ordered list of jumps. A question snapshot gains an optional show condition. A jump holds a condition and a target, which is a page id or the end of the form.
- A condition is a tree: a group (`all` or `any`) of conditions or groups, nested at most 3 levels deep, or a leaf naming a question identity, an operator, and a constant where the operator needs one. Matrix leaves also name a row value. Constants are option values, row values, numbers, dates, times, strings or (for ranking) an option value and N.
- Readers accept format 1 and format 2. A format-1 definition reads as one page, with no conditions or jumps. Stored definitions are never rewritten. Every endpoint that accepts a definition accepts both formats; a missing `format` or an unknown key is 422. Formats 1 and 2 share one list of question types.
- Caps per definition (ADR-017): at most 50 pages, 20 jumps per page, groups nested 3 deep, 1,000 conditions, 100 values in an "any of" list, and 500 code points per text constant. The existing 200-question cap is across all pages.
- Draft save stays structural. Publish additionally rejects: a condition on a question that isn't earlier in the version, an option or row value the question doesn't have, an operator or constant that doesn't fit the type, an empty group, a jump whose target isn't a later page or the end, and an empty page. Publish's "every question accepts at least one answer" stays about the value domain. Publish adds no reachability rule.
- The publish logic checks are also exposed on their own, so the builder can mark broken conditions and jumps in a draft without publishing. "Broken" is computed from the draft, never stored.

### The path function (`@fb/core/answers`, public)

- Two public functions, both pure and total over any definition, including a draft with broken logic:
  - **Next destination from a page**: given a definition, answers and a page, returns the next page or the end. It checks the page's jumps in order and takes the first whose condition holds, else the next page. If the destination page has no question on the path, it is passed over: its jumps are checked as if Next were clicked on it, recursively.
  - **Path**: given a definition and answers, returns the pages visited in order and the questions shown in order, walking from the first page with the next-destination rule.
- Evaluation rules (ADR-017): every operator except "is not answered" is false for an unanswered question, and a question off the path counts as unanswered whatever value is held for it. Text-like comparisons NFC-normalise, trim and lowercase with locale-independent lowercasing on both sides.
- On drafts, a leaf whose question can't be resolved, isn't earlier, or names an option or row value that no longer exists reads as unanswered. A jump with an invalid target is skipped.
- Operators per type are those in ADR-017 and ADR-018: text, email and URL (equals, does not equal, contains, does not contain); phone (equals, does not equal, starts with, does not start with); number (`=` `≠` `<` `≤` `>` `≥`); date (is on, before, after); time of day and date and time (is at, before, after); date range (starts before/on/after, ends before/on/after); single choice (is any of, is none of); multiple choice (includes any of, all of, none of); boolean (is yes, is no); ranking (ranks X in the top N, doesn't rank X in the top N); single-choice matrix row (is any of, is none of); multiple-choice matrix row (includes any of, all of, none of); matrix rows also have is answered and is not answered; address (country is any of, country is none of, only when the country line is shown). Every type has "is answered" and "is not answered".

### Answers (`@fb/core/answers`)

- The answer union gains one arm: an object whose values are strings or lists of strings (matrix, date range, address).
- `validateAnswers` keeps its signature but evaluates the path first, then builds the strict schema from the questions on the path: a question off the path accepts no key (an answer is refused), and `required` applies only on the path.
- `interpretAnswers` takes the response's stored path as well, and reports each question of the version, in order, as answered (with its display value), skipped (on the path, no answer) or not shown (off the path).

### New question types and settings (`@fb/core/definition`)

Each is a module alongside the existing seven, with structure, publish rules, answer schema and display, per ADR-018:

- **Phone**: answer is E.164 (`+` and at most 15 digits). The shared answer schema strips spaces, dashes, dots and parentheses before checking, so the browser and server normalise identically. No country default and no phone library.
- **URL**: `http` or `https`, parses with a host, at most 2,048 code points, trimmed, never normalised. Core compiles without DOM or Node types, so it relies on Zod's URL check with protocol and host rules rather than the global `URL`.
- **Time of day**: `HH:MM`, 24-hour, with optional earliest and latest; publish rejects earliest after latest.
- **Date and time**: local `YYYY-MM-DDTHH:MM`, no zone, no seconds, with optional earliest and latest.
- **Date range**: `{ start, end }` dates, start on or before end, both within the optional bounds, both or neither.
- **Ranking**: 2 to 20 options (the existing option model); the answer lists every option value exactly once.
- **Single-choice matrix** and **multiple-choice matrix**: rows (1 to 50, each a builder-minted row value and a label, unique values) and columns (the existing option model, at most 12, with the same minimums as single and multiple choice). Required means every row answered; an optional matrix accepts any subset of rows, and an answered multiple-choice row has at least one column. No answered row means no key.
- **Address**: six fixed lines (line 1, line 2, city, region, postal code, country), each shown or hidden and required or optional, at least one shown. Filled lines only, trimmed, at most 200 code points each. An optional address with every line empty has no key; once any line is filled, the required lines must be. Country is an ISO 3166-1 alpha-2 code from a list held in core.
- **Number display setting**: `input` (default), `rating` (stars, whole numbers, min 1, max 3 to 10), `scale` (whole numbers, min 0 or 1, max 2 to 10, optional end labels), `slider` (needs min, max and step) and `nps` (fixed whole numbers 0 to 10, with end labels). Changing the display keeps the identity.
- **Step constraint on number**: optional positive decimal with at most 4 decimal places; a valid answer is min plus a whole number of steps, or a whole multiple when there's no min, checked by scaling to integers. With whole numbers only, the step must be whole.
- **Must be yes on boolean**: the answer must be `true`, and the setting makes the question required (on the path).
- New question type names are plain strings in the persistence model's type column, so no database migration is needed for the types themselves.

### Editing (`@fb/core/editing`)

- New operations: add, remove and reorder pages; move a question to another page and position; set a page's title and description; set and clear a question's show condition; add, remove, reorder and edit a page's jumps; add, remove and reorder matrix rows, minting row values with the same id source as options; upgrade a format-1 definition to format 2 (one page with a minted id).
- Removing a question, option, row or page never touches conditions or jumps that reference it. "Treat as a new question" rewrites every condition in the draft that names the old identity to the new one.

### Persistence and server (`@fb/server`)

- Each response stores the path it was given as rows: one row per shown question, keyed by response and question, with a foreign key to the version's question keys (like answer rows) and cascade deletion with the response, so erasure (ADR-013) removes it. Submit writes the path, and edit replaces it together with the answers, in the same transaction.
- An append-only migration creates the table and fills in, for every existing response, every question in its version.
- Submit and edit validate with the path-aware `validateAnswers` against the stored definition of the response's version, so an off-path answer is 422 `ValidationFailed`.
- Analytics read the stored path with plain SQL and never re-run the evaluator. Per question and per version, and combined: responses, shown, answered, skipped (shown minus answered) and not shown (responses minus shown). Option shares keep answered responses as their base.
- New aggregates: ranking per option (mean position, first-place count, base = answered responses of versions that offered the option); matrix per row and column (count, share, base = answered rows in versions that had both); NPS (promoter, passive and detractor counts and score) per version whose snapshot uses the NPS display, and combined over those versions. Rating, scale and slider use the number aggregates. Phone, URL, time, date and time, date range and address report counts only. No raw values or samples are ever returned.

### HTTP API (`@fb/http-api`) and client

- Major `info.version` bump covering format 2, the path rules and the new types. `openapi.json` and the generated client are regenerated.
- The definition JSON schemas accept format 2 and the new types. The admin response read includes the response's stored path, so the builder can show not shown.
- The analytics response gains not-shown counts and the ranking, matrix and NPS aggregates above.
- The advisory answer schema lists a question as `required` only if it is required, has no show condition, and sits on a page no jump can pass over. It expresses the phone and time patterns, ranking as unique items from the option values with exactly as many items as options, and matrix as an object with one property per row value; it carries date-range order, step and date-and-time bounds as `x-fb-*` keys.
- No new endpoints. Duplicate is a read of a version or draft followed by `POST /forms`; restore is a read of a version followed by `PUT /forms/{formId}/draft` with the draft's revision, or `null` when there's no draft.

### Renderer (`@fb/renderer`)

- Holds the current page and the history of visited pages; asks the path function for the next destination and labels the button "Submit" or "Next" from it, updating as answers change. Next validates the current page's on-path questions; Submit validates the whole path. Back pops the visited history and never re-runs jumps.
- Leaves off-path answers out of the submit body but keeps them in memory.
- On a page change, focuses the new page's heading (the page title, or the form title when untitled) and relies on scroll-to-focus; a failed Next lists the page's issues and focuses the first invalid field.
- The element dispatches `pagechange` with `{ pageId, title }` (title null when the page is untitled); the component exposes the same as a callback prop. The element never writes `document.title`, history or the URL hash.
- Edit mode starts on the first page with stored answers.
- Preview mode runs the same paging over a draft, using the path function's draft tolerance.
- New inputs: phone (`type="tel"`, `autocomplete="tel"`), URL (`type="url"`, `autocomplete="url"`, adds `https://` visibly when no scheme), time and date-and-time (native inputs), date range (two native date inputs labelled From and To in one group), ranking (unranked list, add-to-ranking buttons, Move up/Move down), matrices (table when the element is wide, one group per row when narrow, by a container query on the element, each row's group labelled by the row), address (lines with their `autocomplete` tokens, country picker named with `Intl.DisplayNames` in the respondent's language), rating, scale, slider and NPS displays (all start empty; the slider shows "Not answered" with no thumb until first moved), and the must-be-yes checkbox. Email gains `autocomplete="email"`.
- Every optional question answered with radios (single choice, boolean, rating, scale, NPS, matrix rows) gets a "Clear answer" control.
- Everything stays inside the element's strict-CSP rules (ADR-008): no static `style` attributes, no inline scripts.

### Builder (`apps/builder`)

- The draft editor shows pages with titles, descriptions and "Page N" labels; adds, removes and reorders pages; moves questions between pages; edits show conditions and per-page jump lists with type-appropriate operators and constants. Broken conditions and jumps are marked from core's logic checks and block publish. Saving a format-1 draft upgrades it to format 2.
- A warning (never a block) for unreachability is best-effort: at minimum, an `all` group that requires a question to satisfy both an operator and its complement.
- Preview runs the paged renderer over the draft with the broken-logic warning beside it.
- Each new type is registered with its editor and its answer display; the number editor gains display and step settings, and the boolean editor gains "must be yes". URL answers display as plain text.
- Duplicate is offered on the draft and on each version; it posts the definition with " (copy)" appended to the title (truncated to the 200-character cap) and opens the new form. Restore is offered on each version; it asks before replacing an existing draft and handles `RevisionConflict` as saves already do.
- The response detail shows answered, skipped and not shown from the stored path. The analytics page shows not-shown counts, the ranking, matrix and NPS tables, all as tables with CSS bars, no chart library.

### Documentation and seed

- The embedding guide gains pages and focus behaviour, the `pagechange` event, format 2, the new types' answer shapes, the custom-renderer contract's path rules (use the exported path function; off-path answers are 422), and the autocomplete tokens.
- The reference host's demo seed adds one paged form that exercises conditions, jumps and the new types, created through the API like the rest of the seed.

## Testing Decisions

- Tests exercise external behaviour through public entry points only, as the boundary rules already enforce: what a function returns, what an endpoint answers and stores, what a respondent or editor sees and can do. No assertions on internal state or private helpers. Each new behaviour is tested at the highest of the seams below that can observe it, and not repeated lower down.
- **`@fb/core` entry points** (prior art: the core package's answers, definition, question-types and editing tests). The main seam: format-1 and format-2 parsing and caps; every publish logic check; the path function across visibility, jumps, first-match order, passing over all-hidden pages, unanswered and off-path semantics, locale-independent text comparison, and draft tolerance; every operator per type; path-aware `validateAnswers` (off-path answers refused, required only on the path); `interpretAnswers` with answered, skipped and not shown; each new type's structure, publish rules, answer schema (including phone normalisation, step scaling, ranking permutation, matrix row rules, address line rules) and display; the editing operations, including conditions left in place on deletions and rewritten by "treat as a new question", and the format upgrade.
- **The HTTP API through `@fb/api-client` against `createFormModuleHandler` on PGlite** (prior art: the http-api respond, drafts, forms, responses, answer-schema and analytics tests). Submit and edit refused with 422 on an off-path answer; the stored path recorded on submit and replaced on edit, and returned on the admin read; formats 1 and 2 accepted and a missing format or unknown key refused; the advisory answer schema's `required` rule and new-type shapes and `x-fb-*` keys (extending the existing contract test that runs the same cases through Zod and a generic validator); duplicate and restore as compositions, including restore over an existing draft with a stale revision, and deleting a never-published duplicate; analytics not-shown counts end to end.
- **The analytics suite run on both PGlite and Postgres** (prior art: the server's shared analytics suite called from its PGlite and Postgres test files). Not-shown counts from the stored path, ranking mean position and first-place counts, matrix row and column counts and bases, and the NPS score across versions with and without the NPS display. The migration that fills in paths for existing responses gets a Postgres test.
- **The `FormRenderer` component against the fake API in Chromium** (prior art: the renderer's form-renderer, states and retries browser tests). Paging, the Next/Submit label updating with answers, per-page validation and focus on failure, Back through visited pages, passing over all-hidden pages, focus on the new page's heading, the `pagechange` callback, edit mode, off-path answers left out of the submit body and restored when they come back on the path, every new input including empty starts, Clear answer, the ranking interaction, the matrix's narrow layout and the must-be-yes checkbox, and preview over a draft with broken logic.
- **Builder components against the fake host in Chromium** (prior art: the builder's draft-editor, publication, form-lifecycle, responses and analytics browser tests). Page, condition and jump editing; broken markers and publish blocked; the unreachability warning; preview; each new type's editor and answer display; duplicate and restore flows; the response detail's answered, skipped and not shown; the analytics tables.
- **Playwright**, extended in two places only (prior art: the renderer's strict-CSP and accessibility specs): the strict-CSP spec renders a paged form using the new inputs from the built element in Chromium, Firefox and WebKit, and the accessibility spec covers focus on page change.

## Out of Scope

- File upload, signature and picture options on choice questions.
- Builder-supplied regular expressions, relative date bounds, checks across answers, and custom or translated error messages.
- Custom ending screens, thank-you text in the definition, and redirects.
- Show conditions on pages, backward jumps and restart, and a reachability rule at publish.
- Conditions comparing two answers, URL parameters or hidden fields as inputs, calculated variables, and piping answers into text.
- A review step before submit, and keeping an unfinished attempt across a reload, on the server or in browser storage. Partial responses and a submission status remain excluded (ADR-002).
- "Page X of Y" progress, auto-advance on answer, and question or page randomisation.
- The element writing `document.title`, history or the URL hash.
- Templates or a template gallery in the module, AI generation in the module, and dedicated duplicate or restore endpoints.
- An answer table, answer filters on the response list, an anonymous-only filter, field selection, batch or filter-scoped delete.
- Tags, status, comments, assignment, submission notifications or webhooks, and shared read-only response links.
- Chart libraries or pie charts, histograms, word clouds or text samples in analytics, small-count suppression, and view, start or drop-off tracking.
- A separate phone layout for the builder.

## Further Notes

- Suggested slicing for `/to-tickets`: format 2 and the path function in core come first, since everything depends on them; then the server path rules, stored path and analytics; then the renderer paging; then the builder's page and logic editors. Each new type, the number displays, step, must be yes, Clear answer, and duplicate and restore are mostly independent vertical slices once format 2 exists, each touching core, the API schema, the renderer and the builder.
- Phone's "does not start with" operator exists because ADR-017 requires every operator to have a complement; it was added when the ADRs were written.
- The research index in this feature's `research/` directory lists the facts the research couldn't settle; none of them blocks this spec.
