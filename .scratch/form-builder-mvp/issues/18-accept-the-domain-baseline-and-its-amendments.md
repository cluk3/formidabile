# Accept the domain baseline and its amendments

Type: grilling
Status: resolved
Map: [Form builder MVP](../map.md)

## Question

[ADR 0001](../../../docs/adr/0001-modular-versioned-form-management.md) is still `Status: Proposed`, yet the map and the spec call it authoritative, and ADRs 0002–0010 are Accepted and narrow it. Is ADR 0001 the accepted product baseline, and are the places where later ADRs depart from it accepted on purpose?

The departures found by the readiness audit (2026-10-20):

- **The form has no name** ([ADR 0005](../../../docs/adr/0005-form-definition-model.md)), against ADR 0001 §4.1 "Name and description".
- **A response has no submission status** ([ADR 0002](../../../docs/adr/0002-mvp-product-calls.md): only submitted responses exist), against §4.5 "Submission status and timestamps" and §8.1.
- **No export** (ADR 0002), against §8.2 "Export of response data".
- **No retention periods and no anonymisation** (ADR 0002), against §9 "Data export, retention, deletion, and anonymization policies are defined".
- **Forms are never deleted** (ADR 0002, [ADR 0007](../../../docs/adr/0007-answer-rows-and-trigger-enforced-persistence-invariants.md)). ADR 0001 doesn't say either way.
- **No analytics filtering** ([ADR 0009](../../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md)), against §8.2 "Filtering and segmentation where appropriate".

Decide:

- Whether ADR 0001 is accepted as is, amended, or replaced.
- How each departure is recorded so a reader can see it's deliberate: an amendments list in ADR 0001, a note in each narrowing ADR, or a superseding ADR.
- Which departures are reopened instead of accepted. The retention and anonymisation one feeds [Personal data classification and erasure](./22-personal-data-classification-and-erasure.md), and the form-deletion one feeds [Form lifecycle: deleting or archiving forms](./23-form-lifecycle-deleting-or-archiving-forms.md).

## Answer

ADR 0001 is the accepted product baseline, amended by the later ADRs, not replaced. No new ADR: the precedence rule lives in ADR 0001 itself.

- **Status and precedence**: [ADR 0001](../../../docs/adr/0001-modular-versioned-form-management.md) is now `Accepted (2026-10-20)`, with its original text kept. A sentence under the header says later accepted ADRs amend it, each amended clause names the ADR that changes it, and the later ADR wins where they disagree.
- **Recording convention**: the one already used in ADR 0002 and ADR 0006. Each departing clause of ADR 0001 gets an inline `(amended 2026-10-20, see ADR-00N)` note, and the amending ADR states the departure, its reason, and the ADR 0001 clause it changes. There's no separate amendments list. Scope departures say "not in the MVP" (deferred, as §13 allows), and model departures are stated as permanent.
- **A clause with no note doesn't make a later ADR's text optional.** If an ADR from 0002 to 0010 departs from ADR 0001 somewhere this audit missed, the later ADR still wins. Anyone who finds such a gap adds the note.

Each departure:

| Departure                                                | Call                             | Note in ADR 0001                                                          | Reason lives in                                                                                   |
| -------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Form has no name                                         | Accepted, permanent model change | §4.1 "Name and description"                                               | ADR 0005 (already stated)                                                                         |
| No form metadata or categorization (missed by the audit) | Accepted, not in the MVP         | §4.1 "Optional metadata and categorization"                               | ADR 0002, new line                                                                                |
| Response has no submission status                        | Accepted                         | §4.5 and §8.1                                                             | ADR 0002, new sentences on the "incomplete responses" call                                        |
| No export of response data                               | Accepted, not in the MVP         | §8.2 "Export"                                                             | ADR 0002, reworded analytics line                                                                 |
| No analytics filters                                     | Accepted, not in the MVP         | §8.2 "Filtering and segmentation"                                         | ADR 0009, new bullet                                                                              |
| No retention periods or anonymisation                    | **Reopened**                     | None yet (§9 gets its note when the owning ticket resolves)               | [Personal data classification and erasure](./22-personal-data-classification-and-erasure.md)      |
| Forms are never deleted                                  | **Reopened**                     | None: ADR 0001 is silent on form deletion, so it's a gap, not a departure | [Form lifecycle: deleting or archiving forms](./23-form-lifecycle-deleting-or-archiving-forms.md) |

Reasons for the accepted ones:

- **Submission status**: a stored response is always submitted (ADR 0002), so `submitted_at` and `edited_at` cover §4.5 and §8.1. A status comes back only if incomplete responses ever exist.
- **Export**: §8.2 says "should", not "must". Whether a person's own data must be exportable to answer a privacy request is passed to [Personal data classification and erasure](./22-personal-data-classification-and-erasure.md).
- **Filtering**: §8.2 says "where appropriate" and leaves host-specific reporting to integration interfaces. The per-version breakdown is a segmentation, and the response list already filters by version, reference and respondent.
- **Metadata and categorization**: external references cover association with host entities, and the §12 bar doesn't need categories.

Until the reopened tickets resolve, ADR 0002's current answers (hard deletion only, no anonymisation, forms closed and never deleted) remain the default.

Changed: ADR 0001 (status, precedence sentence, six inline notes), ADR 0002 (submission status, export, metadata), ADR 0009 (filtering bullet). The map's Notes now call ADR 0001 the accepted baseline as amended.
