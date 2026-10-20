# Personal data classification and erasure

Type: grilling
Status: resolved
Blocked by: 18
Map: [Form builder MVP](../map.md)

## Question

Which stored values are personal data, and how is each one erased when a host must forget a person?

- [ADR 0001](../../../docs/adr/0001-modular-versioned-form-management.md) §9 requires that privacy obligations and lawful deletion are respected even though versions are kept.
- [ADR 0002](../../../docs/adr/0002-mvp-product-calls.md) only allows hard-deleting one response, or all of one respondent's responses, and rules out anonymisation.
- [ADR 0007](../../../docs/adr/0007-answer-rows-and-trigger-enforced-persistence-invariants.md): triggers reject every update and delete on `form_versions`, which stores `published_by` (the publishing actor's `sub`, not null). If a host uses an email or a user id as `sub`, it can never be removed.
- `respondent_id`, the external reference ids and the answers themselves (an email question, free text) are host- or respondent-supplied and may be personal.

Decide:

- The classification of `sub` (as `published_by` and as `respondent_id`), `tenant`, answers and external reference ids.
- Whether the embedding contract requires hosts to send pseudonymous subjects, or the module supports erasing the publisher on versions (and so needs a narrow trigger exception), or both.
- Whether deleting by respondent also covers anything other than responses.
- Whether erasing an admin, rather than a respondent, is in scope for the MVP.
- Whether a person must be able to get their own data out (an access or portability request), now that export of response data isn't in the MVP ([Accept the domain baseline and its amendments](./18-accept-the-domain-baseline-and-its-amendments.md)).
- The inline `(amended …)` note for ADR 0001 §9 "Data export, retention, deletion, and anonymization policies are defined", pointing at whichever ADR records the policy.
- Which ADRs and tickets change ([Persistence model](./10-persistence-model.md), [Identity, authorization and tenancy seam](./09-identity-authorization-and-tenancy-seam.md), ADR 0002, ADR 0007), and the tests that prove erasure leaves versions readable.

## Answer

Recorded as [ADR 0013](../../../docs/adr/0013-personal-data-is-erased-by-hard-deletion-under-pseudonymous-subjects.md).

- **Amended ADRs** (inline notes):
  - [ADR 0001](../../../docs/adr/0001-modular-versioned-form-management.md) §9, on "Data export, retention, deletion, and anonymization policies are defined". No other ADR 0001 clause departs. §4's "Publishing actor, where available" and §9's last paragraph (on retention periods) are met, because the host owns the retention period.
  - [ADR 0002](../../../docs/adr/0002-mvp-product-calls.md): the deletion bullet.
  - [ADR 0006](../../../docs/adr/0006-host-signed-bearer-tokens-and-module-enforced-capabilities.md): the subject rule.
  - [ADR 0007](../../../docs/adr/0007-answer-rows-and-trigger-enforced-persistence-invariants.md) only gains a cross-reference, because its behaviour is unchanged.
- **Amended tickets**: [Identity, authorization and tenancy seam](./09-identity-authorization-and-tenancy-seam.md), [Persistence model](./10-persistence-model.md) and [HTTP API surface](./16-http-api-surface.md) carry amendment notes.
- **Left alone**: no glossary change, because "personal data" isn't a term specific to this domain. The spec is left for [Revise the phased plan and spec](./30-revise-the-phased-plan-and-spec.md).

**Classification**:

| Value                                                                | Classification                                                                                                                                                                                                        | How it's erased                                                                         |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `sub`, as `responses.respondent_id` and `form_versions.published_by` | Personal data: a pseudonymous identifier the host can link to a person                                                                                                                                                | `respondent_id` is erased with the response. `published_by` is never erased (see below) |
| `tenant`                                                             | Not personal data. The contract requires an opaque id that never identifies one person                                                                                                                                | Not applicable                                                                          |
| Answers (every type, as a whole)                                     | Personal data. Free text and email can hold anything, so types aren't classified one by one                                                                                                                           | Deleted with the response                                                               |
| Response external references                                         | Personal data: they link a response to a host entity that may be a person                                                                                                                                             | Deleted with the response, by cascade                                                   |
| Form external references                                             | May be personal                                                                                                                                                                                                       | Removable with `DELETE /forms/{formId}/external-refs`                                   |
| Form definitions (draft and version content)                         | Not personal data, by contract: admins must not put personal data in form content. Removing a whole form belongs to [Form lifecycle: deleting or archiving forms](./23-form-lifecycle-deleting-or-archiving-forms.md) | Not applicable                                                                          |
| `submitted_at` and `edited_at`                                       | Personal only as part of a response                                                                                                                                                                                   | Deleted with the response                                                               |

**Decisions**:

- **Subjects are pseudonymous, by contract.** Every `sub` (admins and identified respondents alike) must be a stable, opaque, pseudonymous identifier, never an email, a name or a phone number. `tenant` must be opaque. The module can't verify either, so `docs/embedding.md` states both. When the host deletes its own mapping from subject to person, the stored value no longer identifies anyone. The reference host's dev subjects (`alice`, `acme-admin`) already comply.
- **The publisher is never erased, and erasing an admin is not in the MVP.** `published_by` stays not null, and the `form_versions` trigger stays unconditional. A host that sends emails as subjects has no remedy inside the module.
  - Deferred, and recorded in ADR 0013 as the way forward: a narrow trigger exception allowing exactly `UPDATE … SET published_by = NULL`, through an append-only migration that makes the column nullable, plus an admin erasure endpoint. ADR 0001 §9 and §4 would both allow it.
  - Rejected: not storing the publisher at all.
- **Deleting by respondent covers responses only.** Answers and response references go by cascade, and no other table holds a respondent's subject.
  - It stays scoped to the caller's tenant, so a person known in several tenants is erased by the host calling once per tenant.
  - Afterwards, a one-per-respondent form accepts a new response from that subject.
- **Anonymous responses are erased only by response id.** They carry no respondent id. A host that must be able to erase them asserts a reference in the grant ([ADR 0012](../../../docs/adr/0012-response-references-are-host-signed-claims.md)) and deletes the responses that `GET /responses?refNamespace=…&refId=…` finds.
- **Access and portability requests have no export endpoint.** The host answers them with `GET /responses?respondentId=…` and then `GET /responses/{responseId}` for each response, optionally rendered with `interpretAnswers` from `@fb/core`. Every `GET /responses` filter is optional, so `respondentId` alone covers all of the tenant's forms.
- **Retention belongs to the host.** The module has no retention periods, schedules or anonymisation (ADR 0002 stands). The host owns its retention period and enforces it through the two delete endpoints.
- **Logs never contain answers, external references or tokens.** Ids and subjects may appear, because subjects are pseudonymous. Which security events get logged at all is now out of scope (see the map).

**`docs/embedding.md`** gains a "Personal data" section stating:

- Subjects are opaque and pseudonymous, and tenants are opaque.
- Form content must not contain personal data.
- To erase a person, call `DELETE /respondents/{respondentId}/responses` once per tenant.
- To erase anonymous responses, assert a reference in the grant and delete by that reference.
- The access-request procedure above.
- The host owns retention.

**Tests**, in phase 4, beside the existing delete tests:

1. `http-api`: after deleting by respondent, the version read and analytics still succeed for every affected form. Analytics counts drop by exactly the deleted responses, and no other respondent's response is touched.
2. `http-api`: after the last response of a version is deleted, that version and its question keys still read. Analytics still lists the version, with its questions present and zero counts ([Analytics queries and cross-version compatibility](./15-analytics-queries-and-cross-version-compatibility.md)).
3. Persistence (PGlite): deleting responses removes their answers and references by cascade without firing any immutability trigger, and `UPDATE form_versions SET published_by = …` is still rejected.
4. `http-api`: after deleting by respondent, the same identified respondent can submit again to a one-per-respondent form.
5. `http-api`: `GET /responses?respondentId=…` with no `formId` lists that respondent's responses across every form in the tenant, and none from another tenant.
