# Research index: questions the seven notes leave open

Built 2026-10-22 from the "Open questions for the owner" sections of the seven notes in this folder. The notes themselves hold the evidence and the "Could not verify" lists; this file only groups the questions that overlap, so they can be settled once instead of seven times.

This index makes no product decisions. Where a theme has an obvious dependency order, it is stated as a dependency, not a recommendation.

## The notes

| Tag | Note | Topic |
|---|---|---|
| QT | [question-types.md](./question-types.md) | Which types products ship; new type vs display setting |
| CL | [conditional-logic-and-branching.md](./conditional-logic-and-branching.md) | Show/hide, jumps, calculated values |
| VR | [validation-rules.md](./validation-rules.md) | Constraints per type, error timing, server trust |
| FS | [form-structure.md](./form-structure.md) | Pages, endings, hidden fields, prefill |
| FR | [form-reusability.md](./form-reusability.md) | Templates, duplicate, import/export, AI start |
| RV | [response-view.md](./response-view.md) | Listing, filtering, reading responses |
| AP | [analytics-presentation.md](./analytics-presentation.md) | Summaries, funnels, charts |

Question tags below follow each note's own numbering (`CL4` is the fourth open question in the logic note). The question-types note lists its open questions as unnumbered bullets, so they are tagged `QT-a` to `QT-g` in the order they appear.

## Themes

Each theme is a decision that appears in more than one note. Settling it once removes or reshapes the listed questions.

### 1. What makes something a question type

The glossary defines a question type by its answer representation and validation. The notes show the boundary is fuzzy in both directions.

- Phone and URL are strings with their own validation, like email, which is already its own type. Is "own validation" enough to be a type? (`QT-a`)
- Ranking fits a string array but order is the answer. Separate type, or order added to multiple choice? (`QT-b`)
- Single-choice and multi-choice matrix need different value schemas. One type or two? (`QT-c`)
- File and signature: is the answer the URL, the data URL, or something else? What is storage? (`QT-d`)
- Address and contact info: one object, or several existing questions? (`QT-e`)
- Payment, scheduling, hidden fields and scores: answers, or side records? (`QT-f`, `FS6`)
- Validation per type decides what "display setting" means for numbers (`VR2` on email attributes, `VR5` on range changes).

Depends on: theme 4 (answer representation and identity). Unblocks: which validation rules (theme 5) and which summaries (theme 9) exist.

### 2. Questions a respondent was not shown

The MVP has no conditional visibility, so this state does not exist yet. Four notes need it defined.

- What happens to a hidden question's answer: absent, kept, or rejected? (`CL2`)
- Does "every question accepts at least one answer" mean the value domain, or also that some path shows the question? (`CL3`)
- Is a respondent who was not shown a question in the analytics denominator? ADR-009 covers "not in this version", not "in this version, hidden". (`CL4`, `AP5`)
- Does `required` apply to a hidden question? Today's answer schema rejects a response that omits a required key. (CL section 5)
- Multiple endings only make sense once logic can choose between them. (`FS5`)

Depends on: theme 3 (is logic in scope at all).

### 3. Is logic in scope, and which kind

- First logic feature: visibility (show/hide) or navigation (jump)? (`CL1`)
- Are URL parameters and calculated variables logic inputs? They would be new stored values. (`CL5`)
- Logic editing on a phone. (`CL6`)
- Cross-field validation (end after start) is the first rule that looks like logic. (`VR3`)
- Multi-step paging and jumps share a structural unit. (`FS1`, `FS2`)

Depends on: theme 4 (where rules are stored). Gates: theme 2.

### 4. Definition shape, identity and the format number

Several features each want a new definition format. They should be one decision.

- Paging: stored (new format) or a renderer-only mode? If stored, break markers in the one list or a pages array? Do pages get ids, and must they stay out of answer keys? (`FS1`, `FS2`, `FS3`)
- Logic rules live inside the frozen version; operator-set changes mean a new format. (CL section 5)
- Custom validation messages, ending text and thank-you copy: frozen in the version, or host-owned? (`VR4`, `FS4`)
- An imported template must be `format: 1` and strict. May it omit `format`? (`FR6`)
- Question identity on duplicate: fresh ids or kept? Does any analytics query group by identity without a form id? (`FR1`, and the "could not verify" note in FR)
- Tightening a constraint on the same identity: does a combined mean still make sense? (`VR5`)
- New types mint new identities (`QT` section 4), so every type added in theme 1 interacts here.

Depends on: nothing. This is the root theme: themes 1, 2, 3, 5, 7 all route through it.

### 5. Rule language, regex and the strict CSP

The renderer runs under `default-src 'self'; script-src 'self'` with no `unsafe-eval`.

- Condition tree, or an owned expression grammar? (CL section 5)
- Builder-supplied regex at all, given ReDoS on the server? (`VR1`)
- Cross-field rules as fixed checks, not an expression language? (`VR3`)
- Relative dates conflict with immutable versions: the accepted set moves daily while the version does not. (VR section 5)
- Native input attributes (`type="email"`, `autocomplete`) in the renderer. (`VR2`)

CSP also bears on non-rule features. The notes agree on the same cut:

| Fits the current policy | Does not fit without a policy change |
|---|---|
| Signature drawn in the renderer bundle (data URL) | Cross-origin file upload (`connect-src`) |
| File as data URL (but 1 MiB request limit) | Payment and scheduling iframes (`frame-src`) |
| Inline SVG or CSS bars for charts | reCAPTCHA and similar third-party scripts |
| | Chart.js 2.9.4 style injection; Chart.js 4 unverified |

Depends on: theme 3 (is there logic) and theme 1 (which types exist).

### 6. In-progress responses and respondent session

ADR-002: no incomplete responses on the server, no autosave. Every note that touches the respondent journey runs into it.

- Multi-step forms hold every answer in memory; a reload loses the attempt. Still acceptable with several screens? (`FS7`)
- A review step before the single submit: client-side summary only? (`FS10`)
- Partial responses must not grow a status column in the response view. (`RV9`)
- Drop-off and funnel metrics need views, starts or partials. A stored response is always a completion, so completion rate over stored data is 1. Is client-side tracking in scope later, knowing the beacons are personal data? (`AP4`)
- Edit-in-place of a submitted response is the only "resume" that exists today.

Depends on: theme 4 (paging) only for `FS7`. The rest is a standalone product call.

### 7. Copies, templates and versions

- "Edit a copy of version N": a new form, or a replacement for the single draft? (`FR2`)
- Do templates live in the module, or does the host store definitions and post them? (`FR3`)
- May a template cross tenants? (`FR4`)
- Should AI generation live in the module at all, given the prompts leave the host's processor boundary? (`FR5`)
- Share links for responses: host concern or module? (`RV8`)

Depends on: theme 4 (identity on duplicate, format number) and theme 10 (module vs host).

### 8. Response view

- Keep the summary list plus a version-faithful detail, or add an answer table? A table needs a column identity (question identity) and a rule for the cell label. (`RV1`)
- If a table: do dropped questions get their own columns, as analytics orders them? (`RV2`)
- Answer filters on `GET /responses`, or host-built only? Option values, not labels. (`RV3`)
- Anonymous-only filter, and a way to choose which summary fields return. (`RV4`)
- Bulk delete: loop of single deletes, batch with id list, or out of scope? (`RV5`)

Depends on: theme 4 (columns by identity) and theme 10.

### 9. Analytics presentation

- Table as the presentation with a decorative bar, or real charts for choice questions? If charts, is inline SVG acceptable? (`AP1`)
- Number histogram later: bins from the API, not raw values? (`AP2`)
- Text and email: count-only in the aggregate, with the response list as the place to read words? (`AP3`)
- Which denominators move when filters arrive? (`AP5`)
- Label small counts, or leave that to the host? (`AP6`)
- A pie assumes one base; combined shares across versions with different options have none, and multiple-choice shares can exceed 100%. This is a fact about the data, not a question, but it constrains `AP1`.

Depends on: theme 2 (denominators), theme 1 (which types), theme 5 (CSP for charts), theme 11 (personal data).

### 10. Module versus host

The recurring boundary. Each item below is the same question asked about a different feature.

- Ending redirects and navigation: the element emits `submitted`; the host navigates. Ending copy could live in the version. (FS section 5, `FS4`)
- Notifications on submission: the module has no submission event. Host's job? (`RV7`)
- Tags, status, star, comments, assignment. (`RV6`)
- Shared read-only response links. (`RV8`)
- Hidden fields and URL prefill: the host-signed external reference is the trusted channel; prefill is unsigned client data everywhere it exists. If prefill ever exists, is it an editable answer under the question id? (`FS6`)
- Whether the element may touch `document.title`, `history.pushState` or the URL hash. The embedding contract is silent. (`FS8`)
- Focus and scroll behaviour on step change inside a shadow root. (`FS9`)
- Small-cohort suppression and custom reports. (`AP6`, ADR-009)
- Templates stored where. (`FR3`)

Depends on: nothing. This is the second root theme; settling it removes or shrinks questions in themes 7, 8 and 9.

### 11. Personal data (ADR-013)

Every answer is personal data under hard-deletion-only erasure. This constrains choices elsewhere rather than being a feature.

- Raw values in analytics (histograms, date timelines) or text samples (word clouds) would move personal data out of the aggregate. `AP2`, `AP3`.
- Client beacons for views and starts would be a new personal-data store. `AP4`.
- Response share links and AI generation prompts cross the host's processor boundary. `RV8`, `FR5`.
- Segmenting by metadata the module does not collect (UTM, device, location) would be new collection, not a view. (RV section 5)
- Hard delete of a selected set is not one call today. `RV5`.

## Dependency sketch

```
10 Module vs host ─┐
                   ├─> 7 Copies/templates ─> 8 Response view ─> 9 Analytics
4 Definition shape ┤                                              ^
  and identity     ├─> 1 Question types ─> 5 Rules and CSP ───────┤
                   └─> 3 Logic in scope ─> 2 Not-shown questions ─┘
6 In-progress responses (mostly independent; touches 4 for paging)
11 Personal data (constraint on 7, 8, 9, 6)
```

Reading the sketch as an order: themes 4 and 10 are roots; 3 gates 2; 1 and 5 depend on 4. This is only the dependency structure of the questions. It is not a priority ranking.

## Facts the notes could not settle

These need a look at this repo or a hands-on trial, not more web research.

- Do any analytics queries group by question identity without scoping by form id? Decides whether kept ids on duplicate could merge two forms. (FR "could not verify")
- Does the server callsite that maps a failed answer parse to `ValidationFailed` behave as the renderer-side reading suggests? (VR "could not verify")
- Does any CSP-restricted embed actually run Typeform's signature widget, Fillout's HTML field, or Cal.com? The CSP verdicts come from what those products load, not from a test in this renderer. (QT, AP "could not verify")
- Screens and flows that exist only as UI (Typeform review step, Tally per-page validation, Google progress bar, Jotform layout modes) are unverified because only written docs were read. Hands-on trials or screenshots are the missing evidence.
- Answer JSON for the complex types is undocumented at most products (Typeform NPS, ranking, matrix, address; Tally, Google, Jotform, Fillout for most complex types). Several type verdicts rest on a control's description.

## Suggested way to use this index

`/grill-with-docs` takes one decision at a time. Themes 4 and 10 are roots (they change what later questions even mean), so grilling them first avoids reopening later answers. Themes 2, 3 and 5 are tightly coupled and read best as one session. Themes 6 and 11 are narrow product calls that can be settled in passing. Update `GLOSSARY.md` and add ADRs as the grill produces decisions; delete a question here only when its answer is recorded there.
