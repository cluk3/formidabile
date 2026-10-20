# ADR-013: Personal data is erased by hard deletion, and subjects are pseudonymous

- **Status:** Accepted
- **Date:** 2026-10-20

The module's personal data is the token subject (stored as `responses.respondent_id` and `form_versions.published_by`), every response's answers, its external references and its timestamps, and possibly a form's external references. Tenants and form content are not personal data, by contract. Hosts must send opaque, pseudonymous subjects and tenants, so the only erasure the module performs is hard deletion of responses, which the host triggers. Published versions stay fully immutable, publisher included. This defines the ADR-001 §9 policy for export, retention, deletion and anonymisation that ADR-002 left implicit, keeps ADR-002's "no retention periods or anonymisation", and amends ADR-006, whose subject had no format rule.

The calls a reader is most likely to "fix" by mistake:

- **`published_by` can never be erased, by design.** The trigger on `form_versions` (ADR-007) stays unconditional. The publisher is protected by the contract instead: when the host deletes its own mapping from a subject to a person, the stored value no longer identifies anyone. A host that breaks the contract by sending emails or names as subjects has no remedy inside the module. Erasing an admin is not in the MVP.
- **Answers are classified as a whole, not per question type.** Free text, and an email question, can hold anything, so every answer counts as personal data and leaves with its response.
- **Form content must not contain personal data.** Definitions are frozen into immutable versions. Removing a whole form is a form-lifecycle question, not erasure.
- **Erasure is tenant-scoped.** `DELETE /respondents/{respondentId}/responses` removes the respondent's responses across every form in the caller's tenant, with answers and response references going by cascade. No other table holds a respondent's subject. A person known in several tenants is erased by the host calling once per tenant. Afterwards, a form limited to one response per respondent accepts a new response from that subject.
- **Anonymous responses are erased only by response id.** They have no respondent id. A host that must be able to erase them asserts a reference in the grant (ADR-012) and deletes what `GET /responses?refNamespace=…&refId=…` finds.
- **Access and portability requests use the admin reads, not an export.** Every `GET /responses` filter is optional, so `respondentId` alone lists one person's responses across the tenant. The host fetches each one and can render it with `interpretAnswers` from `@fb/core`.
- **Retention is the host's job.** The module has no retention periods, schedules or anonymisation. The host owns the retention period and enforces it through the delete endpoints, which meets ADR-001 §9's "without unnecessarily retaining personal data beyond the applicable retention period".
- **Logs never contain answers, external references or tokens.** Ids and subjects may appear, because subjects are pseudonymous.

## Considered options

- **A narrow trigger exception that nulls `published_by`**, behind an admin erasure endpoint. ADR-001 §9 allows it ("immutability applies to published form definitions, not necessarily to personal data"), and §4 asks for the publishing actor only "where available". Deferred: it costs a trigger exception, an endpoint and their tests for a host that breaks the contract. It's the way forward if admin erasure is ever needed, through an append-only migration that makes the column nullable.
- **Not storing the publisher at all.** Rejected: ADR-001 §4 asks for it where available, and `VersionSummary` returns it as `publishedBy`.
- **Anonymising responses instead of deleting them.** Rejected for the MVP (ADR-002): hard deletion already meets lawful deletion, and anonymising would keep analytics counts stable only by needing a rule for free text that names the person.
