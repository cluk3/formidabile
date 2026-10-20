# HTTP API surface

Type: grilling
Status: resolved
Blocked by: 11
Map: [Form builder MVP](../map.md)

## Question

What is the module's complete HTTP API: every endpoint, its request and response bodies, its status codes and the error vocabulary? Today these are scattered across [MVP product calls on the ADR open questions](./05-mvp-product-calls-on-the-adr-open-questions.md), [How the chosen stack fits together](./07-how-the-chosen-stack-fits-together.md), [Identity, authorization and tenancy seam](./09-identity-authorization-and-tenancy-seam.md) and [Persistence model](./10-persistence-model.md).

Decide:

- The endpoint list and paths for:
  - forms: create, list (by draft title or else current title), read, and settings (availability, response limit)
  - the draft: read, save with `expectedRevision`, discard, publish
  - versions: publication history, and reading one version
  - respondent operations: load the current version, submit, read own response, edit
  - admin response operations: list, read, delete one, delete by respondent
  - analytics: the path only. The body and its empty-form behaviour are fixed in [Analytics queries and cross-version compatibility](./15-analytics-queries-and-cross-version-compatibility.md).
  - external references: add or remove on forms, and lookups of forms and responses by reference
- The error vocabulary and status codes in one table: `ValidationFailed` (422), `version_superseded`, `already_responded` (with a pointer to the existing response), revision conflicts (409), "no draft", a closed form, and the 401/403/404 rules from ADR 0006. Decide how each code is distinguished in the body.
- Envelopes in Effect Schema (`Schema.NullOr`, not `Schema.optional`), and which bodies carry `Schema.Json` with the core's Zod JSON Schema.
- How draft and response revisions travel (in the body or as `ETag`/`If-Match`).
- Pagination and filtering for the response list (by version and by external reference), sized for the MVP.
- Which operations the renderer, the builder and the reference host each call, so the generated client covers them.
- **Support for hosts that render forms themselves**, using only the API and `openapi.json`, with no `@fb/core` (npm distribution is out of scope):
  - **An answer-schema endpoint for each version.** It returns `z.toJSONSchema(buildAnswerSchema(definition))`, generated on the server and cached per version, so a host can validate in the browser with the same rules as the server. Decide:
    - the path, and whether it's public under the same access rules as loading the version;
    - which Zod checks have no JSON Schema equivalent (text trimming is the likely one), and how the response says the server stays the final authority;
    - whether the endpoint's output needs a test against a generic JSON Schema validator.
  - **A custom-renderer contract**, documented in the embedding contract at `docs/embedding.md`, next to the CSP requirements from [Renderer styles under strict host CSPs](./14-renderer-styles-under-strict-host-csps.md). Decide what it promises and requires:
    - how a version is loaded, and that its id must be sent back with the submission;
    - the answer shape for each question type;
    - how to handle `version_superseded`, `already_responded`, the 422 issue paths and revisions for edits;
    - what a renderer must do when it meets a question type it doesn't know (for example, refuse to render the form rather than skip the question);
    - that adding a question type counts as a contract change, and how hosts learn about it (for example, through the definition's `format` number or a list of supported types).

The analytics response shape belongs to [Analytics queries and cross-version compatibility](./15-analytics-queries-and-cross-version-compatibility.md); this ticket only places its endpoint.

## Answer

Recorded as [ADR 0010](../../../docs/adr/0010-respondent-api-split-and-host-owned-lookups.md). [ADR 0006](../../../docs/adr/0006-host-signed-bearer-tokens-and-module-enforced-capabilities.md) is amended with the read rules. No glossary changes: every new name here (the `/respond` group, error tags, service token) is an implementation or host detail.

One fact check ran during the session, as a throwaway script against the [definition prototype](../prototypes/canonical-form-definition/) with `zod@4.6.7` and ajv 8 (2020-12, `ajv-formats`). Its results are marked "(observed)".

- **Audience split**: respondent operations form one `HttpApiGroup` under `/respond`. The admin groups are `forms`, `drafts`, `versions`, `responses` and `analytics`, with resource paths. Each endpoint has one audience, and the OpenAPI tags follow the groups.
- **No path version**: there's no `/v1`. The host owns the mount prefix (the reference host uses `/api`), and `openapi.json`'s `info.version` carries the contract version.
- **Access**:
  - "Read" means `forms:manage` or `responses:read`. It covers the form list, form detail, the versions list, reading one version, and lookups of forms by reference.
  - Reading the draft needs `forms:manage`.
  - Respondent rules are unchanged from ADR 0006.
  - Amended by [Anonymous respondent access and tenancy](./19-anonymous-respondent-access-and-tenancy.md) (ADR 0011): an anonymous grant reaches only the load, the answer schema and submit, and only for its bound form (any other form is a 404). `GET` and `PUT /respond/responses/{id}` with a grant give 401 `identityRequired`, and so does submitting with a grant to a form limited to one response per respondent. Admin endpoints with a grant give 403.
- **Endpoints** (paths are relative to the mount prefix):

  | Group     | Method and path                                                  | Request                                                                                   | Success                                                                                    | Access                       |
  | --------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------- |
  | forms     | `POST /forms`                                                    | `{ definition }`                                                                          | 201 `{ form, draft }`                                                                      | `forms:manage`               |
  | forms     | `GET /forms`                                                     | query: `refNamespace`, `refId` (a pair)                                                   | 200 `{ forms: FormSummary[] }`                                                             | read                         |
  | forms     | `GET /forms/{formId}`                                            |                                                                                           | 200 `FormDetail`                                                                           | read                         |
  | forms     | `PATCH /forms/{formId}`                                          | `{ availability, responseLimit }`, both `NullOr`                                          | 200 `Form`                                                                                 | `forms:manage`               |
  | forms     | `POST /forms/{formId}/external-refs`                             | `{ namespace, refId }`                                                                    | 200 `{ externalRefs }`                                                                     | `forms:manage`               |
  | forms     | `DELETE /forms/{formId}/external-refs`                           | query: `namespace`, `refId`                                                               | 200 `{ externalRefs }`                                                                     | `forms:manage`               |
  | drafts    | `GET /forms/{formId}/draft`                                      |                                                                                           | 200 `{ draft: NullOr(Draft) }`                                                             | `forms:manage`               |
  | drafts    | `PUT /forms/{formId}/draft`                                      | `{ expectedRevision: NullOr, definition }`                                                | 200 `Draft`                                                                                | `forms:manage`               |
  | drafts    | `DELETE /forms/{formId}/draft`                                   | query: `expectedRevision`                                                                 | 204                                                                                        | `forms:manage`               |
  | drafts    | `POST /forms/{formId}/draft/publish`                             | `{ expectedRevision }`                                                                    | 201 `{ form, version: VersionSummary }`                                                    | `forms:manage`               |
  | versions  | `GET /forms/{formId}/versions`                                   |                                                                                           | 200 `{ versions: VersionSummary[] }`, newest first                                         | read                         |
  | versions  | `GET /forms/{formId}/versions/{versionId}`                       |                                                                                           | 200 `Version`                                                                              | read                         |
  | responses | `GET /responses`                                                 | query: `formId`, `versionId`, `refNamespace` + `refId`, `respondentId`, `cursor`, `limit` | 200 `{ responses: ResponseSummary[], nextCursor: NullOr }`                                 | `responses:read`             |
  | responses | `GET /responses/{responseId}`                                    |                                                                                           | 200 `{ response, version }`                                                                | `responses:read`             |
  | responses | `DELETE /responses/{responseId}`                                 |                                                                                           | 204                                                                                        | `responses:delete`           |
  | responses | `DELETE /respondents/{respondentId}/responses`                   |                                                                                           | 200 `{ deleted: number }`                                                                  | `responses:delete`           |
  | analytics | `GET /forms/{formId}/analytics`                                  |                                                                                           | 200 `FormAnalytics`                                                                        | `responses:read`             |
  | respond   | `GET /respond/forms/{formId}`                                    |                                                                                           | 200 `{ formId, responseLimit, version: { id, number, definition }, myResponseId: NullOr }` | respondent rules             |
  | respond   | `GET /respond/forms/{formId}/versions/{versionId}/answer-schema` |                                                                                           | 200 JSON Schema                                                                            | anyone who may load the form |
  | respond   | `POST /respond/forms/{formId}/responses`                         | `{ versionId, answers, externalRefs: NullOr }`                                            | 201 `{ responseId, revision }`                                                             | respondent rules             |
  | respond   | `GET /respond/responses/{responseId}`                            |                                                                                           | 200 `{ response, version, editable }`                                                      | the owning respondent        |
  | respond   | `PUT /respond/responses/{responseId}`                            | `{ expectedRevision, answers }`                                                           | 200 `{ responseId, revision, editedAt }`                                                   | the owning respondent        |

- **Body details**:
  - **Creating a form** creates the form and its first draft in one transaction. Saving with `expectedRevision: null` still creates a draft for a published form that has none.
  - **`FormSummary`**: id, display title (the draft's title, or else the current version's), availability, response limit, current version summary or null, `hasDraft`, and `updatedAt`. The list is unpaginated for the MVP and sorted by `updatedAt` descending; a cursor can be added later without breaking clients. Confirmed by [Expected load and data volumes](./24-expected-load-and-data-volumes.md), as is the unpaginated versions list: the envelope caps them at 100 forms per tenant and 50 versions per form.
  - **`FormDetail`**: the settings, the current version summary or null, a draft summary (`revision`, `basedOnVersionId`, `updatedAt`) or null, and `externalRefs`.
  - **The settings `PATCH`**: null or missing means unchanged, and at least one field must be set. It's last-write-wins. Opening a form that was never published returns `FormNotPublished`.
  - **Form references**: adding an existing one is idempotent, removing a missing one is a no-op, and both return the full set. The 101st reference returns `ExternalRefLimitReached`.
  - **`VersionSummary`**: id, number, `publishedAt`, `publishedBy`, `derivedFromVersionId` and `isCurrent`. `Version` adds the definition.
  - **The response list**: newest first, with keyset pagination on `id` (UUIDv7 ids are ordered by time and unchanged by edits). `limit` defaults to 50, with a maximum of 200. Each `ResponseSummary` has id, form id, version id and number, respondent id, `submittedAt`, `editedAt` and external references, with no answers. This endpoint is also the lookup of responses by reference.
    - Amended by [Personal data classification and erasure](./22-personal-data-classification-and-erasure.md) (ADR 0013): every filter is optional, so `respondentId` alone lists one respondent's responses across every form in the tenant. Hosts answer access requests with this list plus `GET /responses/{responseId}`.
  - **Response reads**: both return raw answers with the version embedded as `{ id, number, definition }`, and the server never returns interpreted prose. The builder runs `interpretAnswers` from `@fb/core`. The respondent's read adds `editable` (whether the form is open) and `revision`.
  - **The respondent load**:
    - `myResponseId` is set only for an identified respondent who has already responded to a one-per-respondent form, so the renderer can go straight to edit mode.
    - `responseLimit` lets the renderer ask an anonymous respondent to sign in before they start.
    - A closed form returns `FormClosed`.
    - Amended by [Anonymous respondent access and tenancy](./19-anonymous-respondent-access-and-tenancy.md): the body adds `respondent: "anonymous" | "identified"`, which the renderer uses with `responseLimit` to decide whether to prompt for sign-in.
  - **Deleting by respondent**: removes the responses across the whole tenant (Persistence model). Deleting none returns `{ deleted: 0 }`, not a 404.
  - **Submissions**: at most 20 references per submission. More gives a `ValidationFailed` from the edge.
    - Amended by [Trust in response external references](./20-trust-in-response-external-references.md) (ADR 0012): the submit body is `{ versionId, answers }`. References come from the token's `refs` claim, and a malformed claim gives 401 `invalid`. The submit and edit bodies reject unknown keys, so `externalRefs` in a body gives 422 `ValidationFailed`.
    - Amended by [Retries and idempotency for creates and submissions](./26-retries-and-idempotency-for-creates-and-submissions.md) (ADR 0016): the submit body is `{ versionId, answers, idempotencyKey }`. The key is a required UUID minted by the client, so a missing or malformed one gives 422 `ValidationFailed`. A retry with a key this respondent already used on this form returns the original response as the same 201 `{ responseId, revision }`, with the current revision, and the body isn't compared. No other endpoint takes a key.
- **Revisions**: they travel in the JSON body as opaque strings, for drafts and responses alike. Requests carry `expectedRevision` and responses carry `revision`. Discarding takes it as a query parameter. There's no `ETag` or `If-Match`.
- **Errors**: each is a `Schema.TaggedError` told apart by `_tag`.

  | Status | `_tag`                    | Extra fields                                                                     |
  | ------ | ------------------------- | -------------------------------------------------------------------------------- |
  | 401    | `Unauthenticated`         | `reason`: `missing`, `invalid` or `identityRequired` (amended, see below)        |
  | 403    | `Forbidden`               | `capability`                                                                     |
  | 404    | `NotFound`                | none, with no resource kind                                                      |
  | 409    | `RevisionConflict`        | none (reload or stay, with no overwrite)                                         |
  | 409    | `NoDraft`                 | none (save with a non-null `expectedRevision`, discard or publish with no draft) |
  | 409    | `FormClosed`              | none                                                                             |
  | 409    | `FormNotPublished`        | none                                                                             |
  | 409    | `VersionSuperseded`       | `currentVersionId`                                                               |
  | 409    | `AlreadyResponded`        | `responseId`, the most recent                                                    |
  | 409    | `ExternalRefLimitReached` | `limit`                                                                          |
  | 422    | `ValidationFailed`        | `issues: [{ path, message }]`                                                    |

  Amended by [Anonymous respondent access and tenancy](./19-anonymous-respondent-access-and-tenancy.md): `Unauthenticated` carries `reason`. It's `missing` with no token, `invalid` for a bad signature, an expired token or a malformed claim set, and `identityRequired` when an anonymous grant is used where an identified respondent is needed.

  Amended by [Form lifecycle: deleting or archiving forms](./23-form-lifecycle-deleting-or-archiving-forms.md) (ADR 0014):

  - A new endpoint, `DELETE /forms/{formId}?expectedRevision=…`, needs `forms:manage` and returns 204. Its checks run `NotFound`, then `FormPublished`, then `RevisionConflict`.
  - A new 409 tag, `FormPublished`, with no extra fields, for deleting a form that has any version. That makes eight state conflicts.
  - Discarding the draft of a never-published form gives `FormNotPublished`, so a never-published form always has a draft.
  - The builder offers "Delete form" in place of "Discard draft" on never-published forms.

  Amended by [Request limits and abuse controls](./25-request-limits-and-abuse-controls.md) (ADR 0015):

  - Two new rows, both checked at the edge before the body is read: 411 `LengthRequired` (no extra fields) for a request with a body and no `Content-Length`, and 413 `PayloadTooLarge` (`limit`, in bytes) when the declared length is over the endpoint's limit.
  - The limits are 1 MiB for the create, draft-save, submit and edit bodies, and 16 KiB for every other body.
  - The `respondentId` path parameter and filter are 1 to 255 Unicode code points, otherwise `ValidationFailed`.
  - The builder and the renderer each map 413 to one plain message.

  On submit, the checks run in the Persistence model's order: `FormClosed`, then `VersionSuperseded`, then `AlreadyResponded`. An edit checks `FormClosed`, then `RevisionConflict`.

  Amended by [Retries and idempotency for creates and submissions](./26-retries-and-idempotency-for-creates-and-submissions.md) (ADR 0016): the idempotency key lookup runs before all three submit checks, so a replay succeeds even after the form closed or was republished, or on a one-per-respondent form.

- **Where the Zod bridge appears** (`Schema.Json` with the core's JSON Schema hook, ADR 0004):
  - **`FormDefinition`**: the create and draft-save requests, `Draft`, `Version`, the respondent load, and the `version` embedded in both response reads.
  - **`AnyAnswers`**: the submit and edit requests, and `answers` in both response reads.
  - **The answer-schema endpoint**: a plain `Schema.Json` object.

  Everything else is ordinary Effect Schema with `NullOr`.

- **The answer-schema endpoint**:
  - **Output**: `z.toJSONSchema(buildAnswerSchema(definition), { target: "draft-2020-12", io: "input" })`, generated in `@fb/http-api` and cached per version. It never throws (observed).
    - Amended by [Expected load and data volumes](./24-expected-load-and-data-volumes.md): not cached. It's generated on every request.
  - **Access**: any version of a form the caller may load (open, and not across a tenant boundary). That covers submitting on the current version and editing on a response's version. It holds identities, types, option values and constraints, not labels.
  - **What survives**: email, integer, number range, calendar-valid dates, option enums, `minSelected`/`maxSelected`, unknown keys and required keys all match Zod (observed).
  - **Divergences (observed), and how each is closed**:
    - Zod trims text before checking `maxLength`, so the JSON Schema rejected `"  hi  "` under `maxLength: 5` while Zod accepted it. The contract says "send text trimmed".
    - The JSON Schema accepted blank text. The generator adds `pattern: "\\S"` to text.
    - Zod's date `min`/`max` is a `refine`, which `toJSONSchema` drops silently, so the JSON Schema accepted out-of-range dates. There's no standard 2020-12 keyword for it, so it's emitted only as `x-fb-minDate`/`x-fb-maxDate`.
    - Zod's duplicate check on multiple choice is a `refine`, also dropped, so the JSON Schema accepted duplicates. The generator adds `uniqueItems: true`.
  - **Authority**: a top-level `description` and `x-fb-authoritative: false` state that the server's check is final.
  - **Test**: one table-driven test in `@fb/http-api` runs every case through Zod and through ajv (2020-12 with formats). They may differ only on the date-range case.
- **Which client calls what**:
  - **Renderer** (component and element): the four `/respond` operations other than answer-schema, because it uses `@fb/core`.
  - **Builder**: the forms reads and `PATCH`, drafts, versions, responses (list, read and both deletes) and analytics. It shows a form's external references read-only, because associations belong to the host (ADR 0002).
  - **Reference host `src/`**: signed in as `acme-admin` or `globex-admin`, it uses `@fb/api-client` to add and remove form references and to list responses by reference for its demo "projects".
  - **Reference host `server/`**: a "form for project X" route mints a service JWT (subject `reference-host`, the project's tenant, `responses:read` only) and calls the in-process `fetch` handler with `GET /forms?refNamespace=…`. The page then mounts `<form-renderer>` with that form id. Only the host back-end looks up by reference (ADR 0010).
    - Clarified by [Lookup cardinality for form external references](./21-lookup-cardinality-for-form-external-references.md): the lookup returns every form carrying the reference, and an unknown one gives an empty list. The host keeps only published, open forms, and mounts the renderer only when exactly one remains. Otherwise it shows a "no open form" or an "ambiguous" page.
  - **The answer-schema endpoint**: no first-party client calls it. Only its contract test does.
- **Custom-renderer contract**: it goes in `docs/embedding.md`, next to the CSP requirements (ADR 0008). It promises and requires:
  1. Load with `GET /respond/forms/{formId}`, then send `version.id` back as `versionId` on submit.
  2. The answer value for each of the seven types. An unanswered optional question has no key, there are no nulls, and text is sent trimmed.
  3. Optional browser validation through the answer-schema endpoint. The server stays the authority, and the date-range gap is listed.
  4. Error handling:
     - `VersionSuperseded`: reload an empty form.
     - `AlreadyResponded`: offer to edit `responseId`.
     - `ValidationFailed`: `issues[].path` starts with the question identity.
     - `RevisionConflict` on an edit: reload or stay.
     - `FormClosed`: show the form as closed.
     - 401: "sign in" if the request was anonymous, "session expired" otherwise. Amended by [Anonymous respondent access and tenancy](./19-anonymous-respondent-access-and-tenancy.md): choose by `reason` ("sign in" for `missing` and `identityRequired`, "session expired" for `invalid`), and send a host-minted grant for anonymous respondents, never no token.
  5. An edit sends `expectedRevision` from the last read.
  6. On an unknown question type, refuse the whole form rather than skip the question.
  7. A new question type is a contract change, marked by a minor bump of `info.version` and a changelog entry. `format` stays at 1 unless an existing shape changes.
  - Amended by [Trust in response external references](./20-trust-in-response-external-references.md): the contract adds that custom renderers never send `externalRefs`, and states the reference guarantee written there.
  - Amended by [Retries and idempotency for creates and submissions](./26-retries-and-idempotency-for-creates-and-submissions.md) (ADR 0016): the contract adds the idempotency rules.
    - Mint `idempotencyKey` at the first Submit, keep it until a 201, and mint a new one for the next response. After a definite tagged error it may be kept.
    - A retry resends the same key with an unchanged body. A replay after closing or republishing still returns 201.
    - An outcome is unknown after a rejected `fetch`, any 5xx, or a reply that doesn't decode. Every 4xx with a known `_tag` is definite. On an unknown submit, keep the answers read-only and offer Retry. On an unknown edit, offer reload or stay.
