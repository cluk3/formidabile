# Embedding the form renderer

This is the host-facing contract of the form module: what a host application does to embed the `<form-renderer>` element, or to write its own renderer against the HTTP API. It restates what the [ADRs](./adr/) decided and adds no rules of its own.

Paths below are relative to wherever the host mounts the API (the reference host uses `/api`). There's no path version: `openapi.json`'s `info.version` carries the contract version ([ADR 0010](./adr/0010-respondent-api-split-and-host-owned-lookups.md)).

## The element

Importing `@fb/renderer/element` (the built bundle, `dist/form-renderer.js`) registers the `<form-renderer>` custom element, with an open shadow root ([ADR 0003](./adr/0003-svelte-renderer-with-two-outputs.md)).

```html
<form-renderer api-base-url="/api" form-id="0192f5a0-7c3e-7b1a-9d2e-3f4a5b6c7d8e"></form-renderer>
<script type="module" src="/assets/project.js"></script>
```

```ts
import "@fb/renderer/element";

const element = document.querySelector("form-renderer")!;
// The host's own endpoint mints the token. The reference host's takes the page's project, not `formId`.
element.getToken = async () => {
  const reply = await fetch("/token?project=apollo");
  if (!reply.ok) throw new Error("No token");
  return (await reply.json()).token;
};
element.addEventListener("submitted", (event) => console.log(event.detail.responseId));
element.addEventListener("error", (event) => console.log(event.detail.code, event.detail.message));
```

### Inputs

| Input          | Kind      | Required | Meaning                                                                                |
| -------------- | --------- | -------- | -------------------------------------------------------------------------------------- |
| `api-base-url` | attribute | yes      | Where the host mounts the API.                                                         |
| `form-id`      | attribute | yes      | The form to load.                                                                      |
| `response-id`  | attribute | no       | Edit mode: edit this response of the respondent's, on the version it was submitted on. |
| `getToken`     | property  | yes      | `({ formId }) => string \| Promise<string>`.                                           |

- The element renders nothing until it has `api-base-url`, `form-id` and `getToken`.
- Changing `form-id` or `response-id` starts over: the form or response is loaded again, and answers on screen are dropped.
- `getToken` is called before every request, with the form the request is about to reach, and its result is sent as `Authorization: Bearer <token>`. It returns a string, never `null`: an anonymous respondent gets a grant the host minted, not "no token" ([ADR 0011](./adr/0011-anonymous-respondents-hold-host-signed-form-bound-grants.md)). If it throws, the request isn't sent and the element shows "We couldn't send your response. Please try again." with the answers still editable.
- There's no references input. A response's references come only from the token ([ADR 0012](./adr/0012-response-references-are-host-signed-claims.md), see [The reference guarantee](#the-reference-guarantee)).

### Events

All three are `CustomEvent`s dispatched on the element itself. They don't bubble and don't cross the shadow boundary from inside, so listen on the element.

- **`submitted`**: `detail` is `{ responseId }`, after a submit's 201 and after an edit's 200.
- **`pagechange`**: `detail` is `{ pageId, title }`, each time the respondent reaches a page, including the first one shown. `title` is the page's own title, or `null` when it has none, and the form's title is not substituted. `pageId` is `null` for a format 1 form, which is one page with no stored id. See [Pages and focus](#pages-and-focus).
- **`error`**: `detail` is `{ code, message }`, each time the element shows a refusal or a failure in place of the form or above it. `message` is the English text shown to the respondent. Per-question validation errors never fire it. The codes are:

| `code`              | When                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `signInRequired`    | A 401 with `reason` `missing` or `identityRequired`, or an anonymous respondent on a form limited to one response per person |
| `sessionExpired`    | A 401 with `reason` `invalid`                                                                                                |
| `closed`            | `FormClosed`, or a response read with `editable: false`                                                                      |
| `unavailable`       | `FormNotPublished` on load                                                                                                   |
| `notFound`          | 404                                                                                                                          |
| `unsupported`       | The form has a question type this renderer doesn't know, so it refuses the whole form                                        |
| `loadFailed`        | Any other load failure                                                                                                       |
| `sendFailed`        | `getToken` threw, a 411, or a `ValidationFailed` that names no question                                                      |
| `submitUnconfirmed` | A submit's outcome is unknown; the answers are locked and the button reads "Retry"                                           |
| `editUnconfirmed`   | An edit's outcome is unknown; Reload or Stay                                                                                 |
| `tooLarge`          | 413 on submit or edit                                                                                                        |
| `versionSuperseded` | `VersionSuperseded`; Reload loads the new version with empty answers                                                         |
| `revisionConflict`  | `RevisionConflict` on an edit; Reload or Stay                                                                                |
| `alreadyResponded`  | `AlreadyResponded`; "Edit your response" opens it                                                                            |

A host can use `error` to add its own sign-in link: the reference host does that on `signInRequired` and `sessionExpired`.

### Pages and focus

A form is an ordered list of pages ([ADR 0017](./adr/0017-show-conditions-and-forward-jumps-decide-the-path.md)). The element shows one at a time, and a format 1 form is a single page.

- **The button**: it reads "Submit" when the current answers would end the form from this page, and "Next" otherwise, and it changes as the respondent answers. There's no "page X of Y", because the total depends on the answers. Back returns to the pages the respondent actually visited, and doesn't re-run jumps.
- **Focus**: on a page change, focus moves to the new page's heading: the page's title, or the form's title when the page has none. The browser scrolls the focused heading into view, and the element makes no scroll calls of its own. A failed Next or Submit lists that page's issues and focuses the first invalid field instead.
- **What the element never writes**: the host page's `document.title`, its history, and its URL. A host that wants a per-page title or a history entry listens for `pagechange` and sets it itself. The browser's own Back key leaves the host page and loses the answers on screen, as a reload does.
- **Edit mode**: with `response-id`, the element opens on the first page with the stored answers filled in. Next checks the jumps again against the edited answers, and there's no way to open a page directly.

```ts
element.addEventListener("pagechange", (event) => {
  const { title } = event.detail;
  if (title !== null) document.title = `${title} · Apollo`;
});
```

### Theming

The element's styles live in its shadow root. Hosts theme it through inherited custom properties and `::part()`.

| Custom property          | Styles                                              |
| ------------------------ | --------------------------------------------------- |
| `--form-renderer-text`   | The text color                                      |
| `--form-renderer-muted`  | Question descriptions                               |
| `--form-renderer-accent` | The "(required)" marker                             |
| `--form-renderer-border` | Question cards and text controls                    |
| `--form-renderer-error`  | Error messages, notices and invalid inputs' outline |

The parts are `root`, `title`, `description`, `question`, `label`, `input`, `error`, `action` (the Reload, Stay and "Edit your response" buttons) and `submit`.

```css
form-renderer {
  --form-renderer-accent: rebeccapurple;
}
form-renderer::part(submit) {
  border-radius: 999px;
}
```

## Tokens

The module never authenticates anyone. The host signs a JWT for each request, and the module checks it and enforces tenants and capabilities itself ([ADR 0006](./adr/0006-host-signed-bearer-tokens-and-module-enforced-capabilities.md)).

### Verification

- The built-in resolver verifies the token against the configured `issuer` and `audience`, with either an HS256 shared `secret` or the host's `jwksUrl`. `exp` is required. The module sets no maximum lifetime.
- `apps/api-server` reads these from `JWT_ISSUER`, `JWT_AUDIENCE`, and `JWT_SECRET` or else `JWT_JWKS_URL`. `createFormModuleHandler` from `@fb/http-api/web` takes them as `jwt: { issuer, audience, secret }` or `jwt: { issuer, audience, jwksUrl }`.
- A host mounting the Fetch handler may pass `resolveActor(request)` instead, to read its own session. Returning `null` means no credentials. Its actors are held to the same limits as a token's claims.

### Claim sets

Exactly two claim sets are valid. Every other combination is 401 `invalid`.

| Claim set        | Required                            | Optional       | Forbidden             |
| ---------------- | ----------------------------------- | -------------- | --------------------- |
| Identified token | `sub`, `tenant`, `capabilities`     | `form`, `refs` | `anonymous`           |
| Anonymous grant  | `anonymous: true`, `tenant`, `form` | `refs`         | `sub`, `capabilities` |

Both also carry `exp`, `iss` and `aud`. `capabilities` holds any of `forms:manage`, `responses:read` and `responses:delete`. A respondent's identified token may have none. Unknown claims are ignored.

```json
{
  "iss": "https://host.example",
  "aud": "form-module",
  "exp": 1792570000,
  "sub": "u_8f3a",
  "tenant": "acme",
  "capabilities": [],
  "form": "0192f5a0-7c3e-7b1a-9d2e-3f4a5b6c7d8e",
  "refs": [{ "namespace": "project", "refId": "apollo" }]
}
```

```json
{
  "iss": "https://host.example",
  "aud": "form-module",
  "exp": 1792570000,
  "anonymous": true,
  "tenant": "acme",
  "form": "0192f5a0-7c3e-7b1a-9d2e-3f4a5b6c7d8e"
}
```

### Limits

- `sub` and `tenant` are 1 to 255 Unicode code points, and `form` is a UUID. Otherwise 401 `invalid` ([ADR 0015](./adr/0015-the-module-bounds-request-sizes-and-hosts-bound-rates.md)).
- `refs` is an array of at most 20 `{ namespace, refId }` entries with no other keys and no duplicates. `namespace` is 1 to 64 code points matching `^[a-z][a-z0-9_.-]*$`, and `refId` is 1 to 255 code points. An empty array means no references. A token carrying `refs`, even empty, must carry `form`. Any breach is 401 `invalid` ([ADR 0012](./adr/0012-response-references-are-host-signed-claims.md)).
- There's no token length cap. The serving Node server's header limit (16 KiB by default, 431 above it) bounds a token, and a `refs` claim near its limits can go over common header limits, so keep references short.

### Form binding

- An identified token without `form` covers its whole tenant.
- An anonymous grant, and an identified token with `form`, reach only that form and its responses. Any other form gives 404, as another tenant's form does, so the 404 doesn't confirm the form exists ([ADR 0011](./adr/0011-anonymous-respondents-hold-host-signed-form-bound-grants.md)).
- An anonymous grant works only on the respondent load, the answer schema and submit. Submitting with a grant to a form limited to one response per respondent, and reading or editing a response with a grant, give 401 `identityRequired`. Admin endpoints give 403.

### Refusals

| Status | Body                                                      | When                                                                                                     |
| ------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 401    | `{ _tag: "Unauthenticated", reason: "missing" }`          | No token. A request with no token is never treated as anonymous.                                         |
| 401    | `{ _tag: "Unauthenticated", reason: "invalid" }`          | A bad signature, an expired token, a wrong issuer or audience, a malformed claim set or a breached limit |
| 401    | `{ _tag: "Unauthenticated", reason: "identityRequired" }` | A grant used where an identified respondent is needed                                                    |
| 403    | `{ _tag: "Forbidden", capability }`                       | Authenticated, without the capability the endpoint needs                                                 |

### Short-lived grants

The module doesn't limit a grant's lifetime or count its uses: a grant stays reusable until it expires ([ADR 0016](./adr/0016-submissions-carry-a-client-minted-idempotency-key.md)). Keep grants, and every token carrying `refs`, to minutes (the reference host uses 5). The element asks `getToken` before every request, so a short lifetime costs nothing. A host that wants one submission per visit enforces it where it mints grants.

## The reference guarantee

A response's external references are the `refs` of the token that submitted it, stored atomically with the response. They're never anything from the browser: the submit body and the element have no way to supply them, and `externalRefs` in a submit or edit body is refused with 422 `ValidationFailed`. Only submit reads `refs`, so an edit leaves the stored references alone, even when its token carries different ones ([ADR 0012](./adr/0012-response-references-are-host-signed-claims.md)).

The guarantee has one limit: anyone holding a token before its `exp` can submit to its form under its references. That's why tokens carrying `refs` are bound to one form and should be short-lived.

## Looking up forms by reference

`GET /forms?refNamespace=…&refId=…` (with `forms:manage` or `responses:read`) returns every form in the caller's tenant carrying that reference, as `{ forms: FormSummary[] }` sorted by `updatedAt` descending. An unknown reference gives 200 `{ forms: [] }`, never 404. There's no availability or publication filter.

Choosing among the forms is the host's job ([Lookup cardinality for form external references](../.scratch/form-builder-mvp/issues/21-lookup-cardinality-for-form-external-references.md)). The reference host, for example, keeps the forms with a `currentVersion` and `availability: "open"`, mounts the element only when exactly one remains, and otherwise shows a "no open form" or an "ambiguous" page. Only the host's back end looks up by reference (ADR 0010). The reference host's token endpoint runs the same choice, so the page and its token can't disagree and the browser never names the form a token is bound to.

Forms gain and lose references through `POST` and `DELETE /forms/{formId}/external-refs` (with `forms:manage`). Adding an existing reference changes nothing, removing a missing one is a no-op, and a form holds at most 100 (`ExternalRefLimitReached` with `limit`).

## Strict CSP and Trusted Types

The element works under a strict Content Security Policy: no `'unsafe-inline'`, `'unsafe-eval'`, hashes or nonces anywhere ([ADR 0008](./adr/0008-renderer-element-adopts-constructable-stylesheets.md)). The host allows only the bundle's script origin and the API origin. The element adopts its styles as a constructable stylesheet, which CSP doesn't govern, and its markup has no inline styles and no inline script. That holds for paged forms and for every question type, and a page change adds no policy requirement ([ADR 0017](./adr/0017-show-conditions-and-forward-jumps-decide-the-path.md)).

Hosts that enforce Trusted Types allow the policy Svelte creates when it loads, `svelte-trusted-html`. The reference host's policy, which the end-to-end tests check in Chromium, Firefox and WebKit:

```text
default-src 'self'; base-uri 'none'; object-src 'none'; require-trusted-types-for 'script'; trusted-types svelte-trusted-html
```

## The custom-renderer contract

A host may write its own renderer against the `/respond` endpoints ([HTTP API surface](../.scratch/form-builder-mvp/issues/16-http-api-surface.md), [ADR 0010](./adr/0010-respondent-api-split-and-host-owned-lookups.md)). Every error body is JSON told apart by `_tag`.

| Method and path                                                  | Request                                  | Success                                                                                        |
| ---------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `GET /respond/forms/{formId}`                                    |                                          | 200 `{ formId, responseLimit, respondent, version: { id, number, definition }, myResponseId }` |
| `POST /respond/forms/{formId}/responses`                         | `{ versionId, answers, idempotencyKey }` | 201 `{ responseId, revision }`                                                                 |
| `GET /respond/responses/{responseId}`                            |                                          | 200 `{ response, version, editable }`                                                          |
| `PUT /respond/responses/{responseId}`                            | `{ expectedRevision, answers }`          | 200 `{ responseId, revision, editedAt }`                                                       |
| `GET /respond/forms/{formId}/versions/{versionId}/answer-schema` |                                          | 200 JSON Schema 2020-12 for that version's `answers`                                           |

### 1. Load, then send the version back

Load with `GET /respond/forms/{formId}`, and send `version.id` back as `versionId` on submit.

- `respondent` is `"anonymous"` or `"identified"`. With `responseLimit: "one_per_respondent"`, an anonymous respondent can't submit, so ask them to sign in before they start.
- `myResponseId` is set only for an identified respondent who already responded to a one-per-respondent form: go straight to editing it.
- `version.definition.format` is `1` or `2`. A renderer reads both: see [Format 2 and the path](#format-2-and-the-path).

### 2. Answers

`answers` maps each question's `id` to an untagged value. An unanswered optional question has no key, and there are no nulls. Unknown keys are refused, and so is an answer to a question that isn't on the [path](#format-2-and-the-path).

| Question type            | Value                                                                                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`                   | A string, sent trimmed: not blank, at most `config.maxLength` (default 10,000) code points                                                                                    |
| `email`                  | An email address string, at most 254 characters                                                                                                                               |
| `number`                 | A number, an integer when `config.integer`, within `config.min` and `config.max`, on `config.step` when it has one. See [Numbers](#numbers)                                   |
| `date`                   | An ISO calendar date, `YYYY-MM-DD`, within `config.min` and `config.max`                                                                                                      |
| `boolean`                | `true` or `false`. With `config.mustBeYes`, only `true`                                                                                                                       |
| `single_choice`          | One option's `value`                                                                                                                                                          |
| `multiple_choice`        | An array of distinct option `value`s, from `minSelected` (default 1) to `maxSelected` (default all)                                                                           |
| `phone`                  | A string in E.164: `+` and at most 15 digits. Spaces, dashes, dots and parentheses are stripped first, and there's no default country                                         |
| `url`                    | A string, trimmed, at most 2,048 characters, `http` or `https` with a host, stored as typed                                                                                   |
| `time_of_day`            | `HH:MM` on a 24-hour clock, with no seconds and no time zone, between `config.earliest` and `config.latest`                                                                   |
| `date_time`              | `YYYY-MM-DDTHH:MM`, local wall-clock time with no seconds and no time zone, between `config.min` and `config.max`                                                             |
| `date_range`             | `{ "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }`: both dates, start on or before end, both within `config.min` and `config.max`                                               |
| `ranking`                | An array holding every option `value` exactly once, in rank order. An optional ranking is complete or absent                                                                  |
| `single_choice_matrix`   | An object from row `value` to one column `value`. A required matrix needs every row, an optional one accepts any subset of rows, and a matrix with no answered row has no key |
| `multiple_choice_matrix` | An object from row `value` to a non-empty array of distinct column `value`s, with the same row rules                                                                          |
| `address`                | An object holding only the filled lines among `line1`, `line2`, `city`, `region`, `postalCode` and `country`                                                                  |

The question types and their answer shapes come from [ADR 0018](./adr/0018-new-question-types-and-what-makes-a-question-type.md).

- **Objects**: a date range, a matrix and an address are all an object whose values are strings or arrays of strings. A date range is an object and not a two-item array, because the answer is untagged and an array's order would carry a meaning nothing in its shape states.
- **Address**: each question sets every line as shown or hidden and as required or optional (`config.lines.<line>.shown` and `.required`). Send only the shown lines that are filled: each is trimmed and at most 200 code points, and `country` is an ISO 3166-1 alpha-2 code. An optional address with every line empty is unanswered, so it has no key. Once any line is filled, the required lines must be too.
- **Matrix rows**: a row has a stable `value` like an option does, and answers use it, never the label.
- **Ranking**: a ranking has 2 to 20 options, and the respondent adds them to the ranking one by one. Show the options unranked at first, because a list in a default order can't tell "I agree with this order" from "I didn't touch it".

#### Numbers

A `number` question's `config.display` is `input` (the default), `rating`, `scale`, `slider` or `nps`. The display changes only the control, and the answer is the same number: a rating, a scale, a slider and NPS all store a plain integer or decimal, and changing the display keeps the question's identity.

| `config.display` | Control and publish rules                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `input`          | A number field                                                                                               |
| `rating`         | Stars: whole numbers from 1 to a maximum of 3 to 10                                                          |
| `scale`          | Whole numbers from 0 or 1 to a maximum of 2 to 10, with an optional `minLabel` and `maxLabel`                |
| `slider`         | Needs `min`, `max` and `step`. It starts with no answer ("Not answered") until the respondent first moves it |
| `nps`            | Whole numbers 0 to 10, with `minLabel` and `maxLabel`. Analytics read it and report the NPS score            |

`config.step` is an optional positive decimal with at most 4 decimal places, on any number question. A valid answer is `min` plus a whole number of steps, or a whole multiple of the step when there is no `min`. The check scales both sides to integers, so compare the same way and not with floating-point arithmetic. When only whole numbers are accepted, the step is a whole number.

#### Must be yes

A boolean with `config.mustBeYes` is required, and the only accepted answer is `true`. Show it as one checkbox, where an unticked box means unanswered. Without `mustBeYes`, show two radios, because an unticked checkbox can't tell No from unanswered.

#### Autocomplete

The element sets `autocomplete` tokens so browsers can fill the inputs, and a custom renderer should do the same:

| Input               | Token                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `email`             | `email`                                                                                                                              |
| `phone`             | `tel`                                                                                                                                |
| `url`               | `url`                                                                                                                                |
| `address` lines     | `address-line1`, `address-line2`, `address-level2` (city), `address-level1` (region), `postal-code` and `country` (the country line) |
| `text` and the rest | None                                                                                                                                 |

#### Format 2 and the path

[ADR 0017](./adr/0017-show-conditions-and-forward-jumps-decide-the-path.md) makes a form a list of pages with conditions and jumps, in definition `format: 2`. `openapi.json`'s `info.version` went to `1.0.0` for it, a major bump, because a renderer that ignores conditions now has submissions rejected.

- **Both formats are read.** `version.definition` is `{ format: 1, title, questions }` or `{ format: 2, title, pages: [{ id, title?, description?, questions, jumps }] }`. A format 1 form is one page with no conditions, and nothing stored is ever rewritten. Every endpoint that takes a definition accepts both formats and stores it as sent. A missing `format` or an unknown key gives 422.
- **Show conditions** sit on a question (`showCondition`). A question without one is shown whenever its page is reached. **Jumps** sit on a page: an ordered list of `{ condition, target }`, where `target` is a later page's `id` or `"end"`. They're checked when the respondent leaves the page, the first match wins, and with no match the respondent goes to the next page. A condition names question ids, option values and row values, never labels or positions.
- **The path** is the questions a respondent is shown, given their answers. **Use the path function exported from `@fb/core/answers`** and don't write your own: `pathOf(definition, answers)` returns `{ pages, questions }`, and `nextDestination(definition, answers, page)` returns `{ kind: "page", page }` or `{ kind: "end" }`. It's pure, it runs in the browser, and it's the function the server uses, so the two can't disagree. A page whose questions are all off the path is passed over.
- **An answer off the path is 422.** `required` means required on the path, so a hidden required question isn't demanded, and an answer to a question the path doesn't reach gets `ValidationFailed`, the same as an unknown key. Leave answers that fall off the path out of the submit body, and keep them locally so that changing the earlier answer back restores them.
- **Each response stores the path it was given**, so the admin views and analytics report each question as answered, skipped (on the path, unanswered) or not shown (off it).
- **A draft may hold broken logic**, such as a condition on a deleted question or a jump to a page that is no longer later. The path function never fails on one: a condition it can't resolve reads that question as unanswered, and a jump whose target isn't a later page or the end is skipped. So a preview of a draft with broken logic still renders, and a host that previews drafts should show a warning beside it. Publish refuses a draft with broken logic, and a published version has passed that check.

### 3. Optional browser validation

`GET /respond/forms/{formId}/versions/{versionId}/answer-schema` returns a version's answer schema as JSON Schema 2020-12, so a renderer can check `answers` before sending them. Using it is optional.

- **Access**: anyone who may load the form, for any of its versions: the current `version.id` for a submit, the response's `versionId` for an edit. A grant reaches only its bound form. Another form, or a version that isn't the form's, gives 404 `NotFound`; a closed form gives 409 `FormClosed`.
- **The server stays the authority**: the schema carries `x-fb-authoritative: false` and says so in its `description`. A submit or edit that passed it can still get 422 `ValidationFailed`, so handle that as in [4. Errors](#4-errors).
- **What it holds**: question identities, types, option values and constraints, never labels. It's built on every request; cache it per version id if you like, since a version never changes.
- **Validating**: use a 2020-12 validator with the `email` and `date` formats, and declare the `x-fb-` keywords as annotations. With ajv:

  ```ts
  import { Ajv2020 } from "ajv/dist/2020.js";
  import addFormats from "ajv-formats";

  const ajv = new Ajv2020({ allErrors: true });
  addFormats(ajv);
  ajv.addVocabulary([
    "x-fb-authoritative",
    "x-fb-minDate",
    "x-fb-maxDate",
    "x-fb-minDateTime",
    "x-fb-maxDateTime",
    "x-fb-startOnOrBeforeEnd",
    "x-fb-step",
  ]);
  const validate = ajv.compile(answerSchema);
  ```

- **The gaps**: on trimmed answers the schema accepts and refuses exactly what the server does, except:
  - **Dates and times**: standard JSON Schema can't compare dates, so the bounds appear only as annotations that a generic validator ignores, and you check them yourself. ISO dates and local date-times compare correctly as strings.
    - A `date` question's and a `date_range` question's `config.min` and `config.max` are `x-fb-minDate` and `x-fb-maxDate`, inclusive `YYYY-MM-DD` strings. A date range is also marked `x-fb-startOnOrBeforeEnd: true`: its `start` must not be after its `end`.
    - A `date_time` question's bounds are `x-fb-minDateTime` and `x-fb-maxDateTime`, inclusive `YYYY-MM-DDTHH:MM` strings.
    - A `time_of_day` question's `config.earliest` and `config.latest` aren't in the schema. Take them from the definition. The schema holds only the `HH:MM` pattern.
  - **Steps**: a `number` question's `config.step` is `x-fb-step`, and only the server checks it. Use the scaled-integer check described under [Numbers](#numbers).
  - **Trimming**: the server trims text before checking its length, while the schema checks the string as given. Trim text before validating, as you must before sending.

### 4. Errors

| Status | `_tag`              | Do                                                                                                                                                             |
| ------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 409    | `VersionSuperseded` | Reload an empty form (`currentVersionId` names the new version)                                                                                                |
| 409    | `AlreadyResponded`  | Offer to edit `responseId`, the respondent's most recent response                                                                                              |
| 422    | `ValidationFailed`  | Show each of `issues: [{ path, message }]`. An answer's `path` starts with the question's `id`; a malformed body names its field, such as `["idempotencyKey"]` |
| 409    | `RevisionConflict`  | On an edit: reload or stay, never overwrite                                                                                                                    |
| 409    | `FormClosed`        | Show the form as closed                                                                                                                                        |
| 409    | `FormNotPublished`  | On load: show the form as unavailable                                                                                                                          |
| 413    | `PayloadTooLarge`   | Tell the respondent the answers are too long to send (`limit` is in bytes)                                                                                     |
| 401    | `Unauthenticated`   | "Sign in" for `missing` and `identityRequired`, "session expired" for `invalid`                                                                                |
| 404    | `NotFound`          | The form or response doesn't exist for this token                                                                                                              |

On submit the module checks `FormClosed`, then `VersionSuperseded`, then `AlreadyResponded`. An edit checks `FormClosed`, then `RevisionConflict`.

### 5. Edits

An edit sends `expectedRevision` from the last read (`response.revision`) or the last edit's `revision`. Revisions are opaque strings. An edit stays on the response's own version, and `editable: false` means the form is closed. Edits take no idempotency key.

### 6. Unknown question types

When the definition holds a question type the renderer doesn't know, refuse the whole form rather than skip the question.

### 7. New question types

A new question type is a contract change, marked by a bump of `openapi.json`'s `info.version` and a changelog entry. ADR 0018's nine question types, the number displays, the step and must-be-yes shipped with format 2 in the `1.0.0` bump, and formats 1 and 2 accept the same question types ([ADR 0018](./adr/0018-new-question-types-and-what-makes-a-question-type.md)).

### 8. Duplicate, restore and templates

None of these has an endpoint of its own. Each is a read plus a call you already have, and each needs `forms:manage` ([ADR 0019](./adr/0019-duplicate-and-restore-and-form-scoped-question-identity.md)).

- **Duplicate** a form: read the definition you want, then `POST /forms` with it. Read a published version with `GET /forms/{formId}/versions/{versionId}`, or the draft with `GET /forms/{formId}/draft`, in the caller's tenant. The new form is never published, and only the definition is copied: its external references, availability and response limit start at a new form's defaults, because they describe the source form's place in the host. Question ids, option values, row values and page ids are kept, so conditions and jumps carry over unchanged. Question identity belongs to one form, so two forms holding the same question id don't claim to ask the same question. Add " (copy)" to the title yourself if you want it, and keep the title within its 200-character cap.
- **Restore** one of a form's own published versions: read it with `GET /forms/{formId}/versions/{versionId}`, then `PUT /forms/{formId}/draft` with that definition. Send `expectedRevision: null` when the form has no draft, which creates one, and the draft's `revision` when it has one, so a save made in the meantime gives `RevisionConflict`. Restore creates no version: it replaces the form's one draft, and publishing that draft makes the next version. Ask before replacing a draft that holds changes.
- **Templates**: the module stores none. A host keeps its template definitions and posts one with `POST /forms` as a new form, in whichever tenant its token names. That is how a template crosses tenants. A definition from any other source, an AI model included, is posted the same way, and publish checks it like any draft.
- **A definition is stored as sent**, in format 1 or 2. Only the builder upgrades a draft to format 2, when it saves.

### Never send `externalRefs`

The submit and edit bodies refuse unknown keys, so `externalRefs` gives 422 and nothing is stored. References come only from the token ([The reference guarantee](#the-reference-guarantee)).

### Idempotency

Every submit carries a required `idempotencyKey`, a UUID the client mints ([ADR 0016](./adr/0016-submissions-carry-a-client-minted-idempotency-key.md)). A missing or malformed one gives 422.

- **The key's lifetime**: mint it at the first Submit, keep it until a 201, and mint a new one for the next response. After a definite tagged error it may be kept. The module stores it with the response, with no expiry: it's unique per form and respondent, and among anonymous respondents per form.
- **Resend an unchanged body**: a retry resends the same key with the same body. A replay returns the original response without comparing bodies, so answers changed under a reused key are lost.
- **Unknown outcomes**: a rejected `fetch`, any 5xx (including a proxy's 502 or 504), and a reply that doesn't decode into the contract mean the submit may have committed. Every 4xx with a known `_tag` is definite. On an unknown submit, keep the answers read-only and offer Retry, with the same key and body. On an unknown edit, offer reload or stay. Don't retry automatically.
- **Replays still succeed**: the key is looked up before every other submit check, so a replay after the form closed or was republished, or on a one-per-respondent form, still returns 201 with the same `{ responseId }` and the current `revision`.

## Host duties

- **Rate limits**: the module doesn't rate-limit ([ADR 0015](./adr/0015-the-module-bounds-request-sizes-and-hosts-bound-rates.md)). Hosts rate-limit `/respond`, especially submit, and the endpoint that mints grants.
- **Timeouts**: the standalone `apps/api-server` sets `headersTimeout` to 10 s and `requestTimeout` to 30 s. Under the Fetch handler (`createFormModuleHandler`), the host's server owns connection and request timeouts. The module's Postgres connections set `statement_timeout` to 30 s in both modes.
- **Migrations**: the module never migrates implicitly. A host mounting the Fetch handler runs the exported migration itself, through the handler's `migrate()` (or `migrate` from `@fb/server/migrate`), before serving. Its tables live in the `form_management` Postgres schema ([Persistence model](../.scratch/form-builder-mvp/issues/10-persistence-model.md)). The standalone server migrates at startup.
- **Body limits**: create, draft save, submit and edit bodies may be at most 1 MiB, and every other body at most 16 KiB. A body must declare its `Content-Length`: without one it's 411 `LengthRequired`, and over the limit it's 413 `PayloadTooLarge { limit }`, before any of it is read. A host building requests in-process passes them through `declareLength` from `@fb/http-api/web` first. These limits hold the same in both serving modes.
- **The design envelope** is advisory: it's neither enforced nor tested, and going past it is unsupported, not refused ([Expected load and data volumes](../.scratch/form-builder-mvp/issues/24-expected-load-and-data-volumes.md)).
  - At most 10 tenants, 100 forms per tenant, 50 versions per form, 10,000 responses per form, and 20 people submitting at once across the instance.
  - There are no per-version caches: the answer schema is built on every request.
  - Analytics are computed on read, with an estimated budget of about 1 second for 20 questions × 10,000 responses. The 200-question worst case may take several seconds.

## Personal data

The module's personal data is each response (answers, references and timestamps), the token subject, and possibly a form's references ([ADR 0013](./adr/0013-personal-data-is-erased-by-hard-deletion-under-pseudonymous-subjects.md)).

- **Subjects are opaque and pseudonymous**: never an email or a name. The subject is stored as a response's respondent and as a version's publisher, which can never be erased; deleting the host's own mapping from subject to person is what makes it anonymous.
- **Tenants are opaque.**
- **Form content holds no personal data**: definitions are frozen into immutable versions.
- **The host owns retention**: the module has no retention periods, schedules or anonymisation. The host enforces its retention period through the module's delete endpoints.

### Erasing a person

Erasure is hard deletion of responses, with their answers and references, and needs `responses:delete`:

- `DELETE /respondents/{respondentId}/responses` deletes every response the subject gave to any form in the caller's tenant, and answers 200 `{ deleted: n }`, or `{ deleted: 0 }` when there was nothing to delete. `respondentId` is the subject the respondent's tokens carried as `sub`, 1 to 255 code points (otherwise 422). Erasure stops at the tenant: a person known in several tenants is erased by calling once per tenant, with an admin token for each.
- Anonymous responses have no respondent, so they're erased only by response id. A host that must be able to erase them asserts a reference in each grant's `refs`, lists `GET /responses?refNamespace=…&refId=…` (with `responses:read`), and deletes each response it finds with `DELETE /responses/{responseId}` (204, or 404 when it's already gone or in another tenant). A grant without `refs` leaves its response erasable only by an id the host recorded itself, for example from the `submitted` event.
- Published versions stay readable and unchanged, publisher included. Afterwards the same subject can respond again to a one-per-respondent form, and an idempotency key from before the erasure creates a new response.

### Answering an access request

With `responses:read`, `GET /responses?respondentId=…` and no other filter lists the subject's responses across every form in the tenant, newest first: up to 50 per page unless `limit` (1 to 200) says otherwise, with `nextCursor` passed back as `cursor` until it's null. The list carries summaries, so read each one with `GET /responses/{responseId}`, which gives `{ response, version }`: the raw answers and the version they were submitted under. `interpretAnswers(version.definition, response.answers)` from `@fb/core/answers` pairs each answer with its question and a display string. As with erasure, ask once per tenant, and find anonymous responses through the references their grants asserted.
