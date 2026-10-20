# ADR-002: MVP answers to the ADR-001 open questions

- **Status:** Accepted
- **Date:** 2026-10-19

The MVP settles the ADR-001 §13 open questions with the smallest behaviour that meets the §12 bar. Each answer keeps the §5 invariants. The calls below are the ones a reader is most likely to "fix" by mistake.

- **A submission against a superseded version is rejected, not accepted.** The respondent reloads and gets an empty form on the current published version, with no answers carried over. Accepting the version the respondent was shown would let any client submit against any old version, which reopens historical versions in all but name. Mid-session publication is rare, and autosave can soften it later.
- **Responses can be edited, but never move between versions.** Only the identified respondent who submitted can edit, only while the form is open, and only against the response's original form version. Edits overwrite the answers with no history and are rejected if made from a stale copy. Moving a response onto a newer version would mean mapping answers across question snapshots, which is the silent reinterpretation §5 forbids.
- **The response limit is per form, with two modes:** unlimited (the default) and one per respondent. Under one per respondent, a second submission is refused and the respondent is pointed at their existing response to edit. Limits scoped by external reference are left to the host, which decides when to show the form.
- **Dropdown is not a question type.** It's a display setting on single choice, because the answer (one option value) is identical. Changing a question between radio buttons and a dropdown therefore keeps its question identity and its analytics compatibility. For the same reason, short and long text are one text type with a single-line or multi-line display setting (amended 2026-10-19, see ADR-005).
- **Incomplete responses don't exist on the server.** There's no autosave, no resume and no abandoned-response cleanup. A response is stored only when it's successfully submitted. So a response has no submission status: being stored means being submitted, and its submission and edit timestamps are what ADR-001 §4.5 and §8.1 ask for. A status can be added if incomplete responses ever exist.

The other answers are unsurprising:

- One draft per form.
- Historical versions aren't reopened for new submissions.
- Seven question types (text, email, number, date, single choice, multiple choice and boolean), with no file upload and no conditional visibility.
- External references as a mutable association set on forms and a fixed list on responses. A response's list comes from the host-signed token that submitted it, never from the browser (amended 2026-10-20, see ADR-012).
- Analytics inside the module, combining compatible questions by default with the per-version breakdown always visible. Export of response data (ADR-001 §8.2) isn't in the MVP.
- No form metadata or categorization (ADR-001 §4.1) in the MVP. External references already associate forms with host entities.
- An open/closed availability toggle that also freezes edits.
- Hard deletion of a single response or of all of one respondent's responses, with no retention periods or anonymisation. Hard deletion is the module's whole erasure policy, and the host owns retention (amended 2026-10-20, see ADR-013).
- Preview that runs only in the browser and never creates a response.
