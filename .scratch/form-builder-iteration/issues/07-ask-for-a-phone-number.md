# 07: Ask for a phone number

**What to build:** A phone question stores an international number. The respondent can type spaces, dashes, dots, or parentheses, and gets a clear message when the country code is missing. Conditions can test equals, does not equal, starts with, and does not start with. The field offers telephone autocomplete. Follow ADR-018. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** 03 (Show a question only when its condition holds)

**Status:** ready-for-agent

- [x] The question type is `phone`. The stored answer is E.164: `+` followed by at most 15 digits. There is no default country and no phone-number library.
- [x] The shared answer check strips spaces, dashes, dots, and parentheses before validating, so the browser and the server accept the same input. A number with no country code fails with a message that tells the respondent to include one.
- [x] Conditions offer equals, does not equal, starts with, does not start with, is answered, and is not answered.
- [x] The input is a telephone field with telephone autocomplete. The builder can add the question and shows the stored number in the response.
- [x] Analytics for a phone question are counts only, the same shape as text. No raw values or samples are returned.
- [x] The advisory answer schema expresses the phone pattern. This ticket does not bump `info.version`.
- [x] Tests cover structure, publish, the answer schema (including normalisation), display, and the operators at the core entry point; the advisory schema through the HTTP API; and the input in the renderer and the editor in the builder.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-23, implementing agent:** Built on branch `iter/07-ask-for-a-phone-number`. The last box stays open: `vp run ready` includes Postgres and e2e, and CI on the PR, which this worktree does not run.

`phone` is its own question type with an empty config, the same precedent as email. The shared answer schema strips spaces, dashes, dots, and parentheses, then requires `+` and at most 15 digits. A value with no `+` fails with "Include a country code, starting with +". There is no default country and no phone-number library. `info.version` stays `1.0.0`.

Operators are `equals`, `does_not_equal`, `starts_with`, `does_not_start_with`, plus `is_answered` and `is_not_answered`. Both sides of a comparison are stripped the same way, so a condition can route on a country code typed with punctuation. Analytics are the counts-only summary, the same arm as text, email, and date. The advisory schema adds `pattern: ^\+[0-9]{1,15}$`. Ajv checks that stored pattern; stripping runs only in `validateAnswers`, and the HTTP test records that gap.

The renderer input is `type="tel"` and `autocomplete="tel"`. The builder adds the question from the type list and shows the stored number as plain text. A missing country code is the same message in the renderer and on submit.

`vp check` and `vp run boundaries` passed. The phone tests passed: core structure, publish, normalisation, display, and operators; the counts-only merge; the advisory schema and a stored submit through the HTTP API; the telephone input in the renderer; and adding the question plus the stored number in the builder. `vp run check:svelte` and the full `vp test` were not finished in this pass. `vp run check:generated` regenerates a matching document and then fails `git diff --exit-code` until `openapi.json` and `schema.d.ts` are committed.


[You have received this identical output 3 times. Re-reading '/Users/lucacampli/prog-pers/form-builder-worktrees/07-ask-for-a-phone-number/.scratch/form-builder-iteration/issues/07-ask-for-a-phone-number.md:raw' will not change it — use a narrower selector (path:A-B), or proceed with the edit.]