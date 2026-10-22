# ADR-009: Question identity is the analytics compatibility claim

- **Status:** Accepted
- **Date:** 2026-10-20

Combined analytics (ADR-001 §8.2) group answers by question identity and never split one identity automatically. A question identity keeps one question type for life (ADR-005), so the type already guarantees the answer representation. Meaning is the editor's claim, made by keeping the identity or by giving the question a new one (ADR-001 §4.4). Differences between versions of one identity are described, never used to split it: options offered only in some versions, relabelled questions and options, and changed constraints. The per-version breakdown is always shown next to the combined view, so a misleading combination stays visible.

The calls a reader is most likely to "fix" by mistake:

- **A changed range still combines.** A number question whose range moves from 1–5 to 1–10 keeps one combined mean and median. Each version's constraints are reported beside its figures. If the editor means a different scale, the question gets a new identity.
- **The builder offers "treat as a new question".** It keeps the snapshot's content and position, mints a fresh question identity and keeps the option values. ADR-001 §4.4 requires this lever, and this rule depends on it. Otherwise, deleting and re-adding the question is the only way to stop combining.
- **An option's share is measured against the answered responses of the versions that offered it.** An option not offered in a version is treated like a question absent from a version: it isn't counted as "not chosen" there. With differing option sets, single-choice shares don't sum to 100%. A respondent whose path didn't include the question is counted as not shown, never as skipped, and is left out the same way (amended 2026-10-22, see ADR-017). Ranking options and matrix rows and columns use the same base, and an NPS score counts only the versions whose snapshot uses the NPS display (amended 2026-10-22, see ADR-018).
- **Analytics have no filters in the MVP.** ADR-001 §8.2 asks for filtering and segmentation "where appropriate". The per-version breakdown is the only segmentation, and there are no filters by external reference or submission date. The response list filters by version, reference and respondent, and §8.2 leaves host-specific reporting to integration interfaces.

## Considered options

- **Split automatically on any constraint change, or when an option is removed.** Rejected: it guesses at meaning from constraints. It would split harmless changes, such as raising a maximum, and still miss real changes of meaning that leave the constraints alone.
- **Combine counts, but not the mean or median, when a number question's range differs.** Rejected: it's a special case for one type, and the always-visible per-version breakdown already exposes the difference.
