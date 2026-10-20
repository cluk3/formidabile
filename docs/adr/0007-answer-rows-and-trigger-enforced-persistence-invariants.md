# ADR-007: Answer rows, database-enforced invariants, and never-repeating draft revisions

- **Status:** Accepted
- **Date:** 2026-10-20

The module's tables live in their own `form_management` Postgres schema. Form definitions are stored whole, as one JSONB document per draft and per form version, because the definition is versioned by its format number and never migrated (ADR-005). Answers, though, are stored as rows, and the database itself enforces the ADR-001 §5 and §9 invariants it can express: immutability, version-consistent references and the response limit, plus one response per idempotency key (amended 2026-10-20, see ADR-016). The application checks each rule first and gives the friendly error, and the database backs it up.

The calls a reader is most likely to "fix" by mistake:

- **Answers are rows, not a JSONB object on the response.** Each row's composite foreign keys tie it to its response's own version and to a question key that version actually has (`form_version_questions`). That makes "answers reference valid question snapshots" (ADR-001 §9) a database guarantee, and analytics a plain `GROUP BY`. The core still sees one `Answers` object; the repository converts. Snapshot content stays in the JSONB definition, and the key table holds only identity, type and position.
- **Immutability is enforced by triggers only.** Triggers reject every `UPDATE`, `DELETE` and `TRUNCATE` on versions, question keys and question identities, even for the table owner, and reject deleting forms (amended 2026-10-20, see ADR-014: only forms that have a version are protected). There's no privilege-split role and no row-level security. A split role only helps if the app doesn't connect as the owner, and row-level security fails silently (`UPDATE 0`). So tests reset by using a fresh database, never by truncating. The rule covers `published_by` too, so a publisher is never erased (see ADR-013).
- **Draft revisions come from a database sequence, so they never repeat.** Publishing or discarding deletes the draft. If revisions restarted with each new draft, an editor holding revision 3 of a deleted draft could overwrite revision 3 of its successor. The revision is an opaque token, not a counter.
- **`responses.limited` records the limit in force at submission.** The response limit can change at any time, so a plain unique index on `(form_id, respondent_id)` would reject forms that collected duplicates while unlimited. A partial unique index `WHERE limited` closes the race between simultaneous first submissions without advisory locks.
- **Tenant isolation is in the application, not row-level security.** Only `forms` carries `tenant`. Every repository function takes a branded `TenantId` and reaches everything else through a join on `forms`.

## Considered options

- **Answers as one JSONB object per response.** Rejected: version-consistent references would rest only on the per-version Zod schema, and cross-version analytics would need `jsonb_each` over every response.
- **Normalised snapshot columns.** Rejected: every new question type would need a schema migration, against ADR-005's one-module-per-type rule.
- **Deriving the current published version as the highest version number.** Rejected in favour of an explicit `forms.current_version_id` pointer. It's what ADR-001 §4.1 describes, it makes the "failed publication doesn't move the pointer" test direct, and it needs no schema change if versions can ever be reopened.
