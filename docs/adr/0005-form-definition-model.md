# ADR-005: One versioned form definition, answers keyed by question identity

- **Status:** Accepted
- **Date:** 2026-10-19

A draft and a form version hold the same form definition: a title, a description and an ordered list of question snapshots, validated by the shared `zod/mini` core. Format 2 groups the snapshots into pages and adds show conditions and jumps (amended 2026-10-22, see ADR-017). A response's answers are one object keyed by question identity, with untagged values read through that response's own version, so nothing is ever reinterpreted against another version (ADR-001 §5). A value may also be an object of strings or lists of strings, for matrix, date range and address answers (amended 2026-10-22, see ADR-018). Email answers are at most 254 characters, every character cap counts Unicode code points, and the size caps can't all be reached at once within the 1 MiB request body limit (amended 2026-10-20, see ADR-015).

The calls a reader is most likely to "fix" by mistake:

- **The form record has no name.** ADR-001 §4.1 lists a name and description on the form. Here they live only in the versioned definition, so a title change is published like any other change and historical responses show the title they were collected under. The builder lists a form by its draft title, or else its current version's title.
- **A question identity keeps one question type for life.** Changing the type mints a new identity, and publish rejects an identity whose type differs from an earlier version's. Cross-version compatibility for analytics then only has to consider options and constraints, never a change of answer shape.
- **Draft save checks structure only; publish adds completeness rules; stored definitions are read back with structural checks only.** Tightening publish rules must never make a published version unreadable. Publish also guarantees that every question accepts at least one answer, required or not, so a version can never ask a question nobody can answer. Publish also checks conditions and jumps, but this guarantee stays about the value domain, not about whether a question is reachable (amended 2026-10-22, see ADR-017).
- **The definition carries a format number, and published versions are never migrated.** Readers accept every format ever written, instead of rewriting history (ADR-001 §5 rule 11).

## Considered options

- **Answers as tagged values (`{ type, value }`).** Rejected: the version already fixes each question's type, so a tag only duplicates it and can disagree with it.
- **Answers as rows per question in the definition format.** Not decided here. How answers are stored is left to the persistence model; this ADR fixes only their shape at the domain boundary.
- **Allowing a type change under the same identity, with per-pair compatibility rules.** Rejected for the MVP: every pair of types would need a rule, for little benefit.
