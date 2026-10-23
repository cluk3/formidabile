# 03: Show a question only when its condition holds

**What to build:** A question can carry a show condition over earlier answers, combined with all and any, nested up to three groups, using the operators that fit the existing question types. The condition names question identities and option values. The respondent is asked only when it holds. A required question that is hidden does not block them. An answer that falls off the path stays on screen and is left out of the submission; changing the earlier answer brings it back. A page whose questions are all hidden is passed over. Submit and edit reject an answer that is off the path. The response stores the path it was given, and its detail shows each question as answered, skipped, or not shown. A response collected before this iteration shows every question in its version as shown. The path function is public for a custom renderer. Follow ADR-017. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** 02 (Build and answer page by page)

**Status:** ready-for-agent

- [ ] The builder can set and clear a question's show condition. A condition is an `all` or `any` group, nested at most three levels, or a leaf that names a question identity, an operator, and a constant when the operator needs one. It names question identities and option values, never labels or positions, and it can only read a question earlier in the form.
- [x] The existing question types offer: text and email (equals, does not equal, contains, does not contain); number (`=` `≠` `<` `≤` `>` `≥`); date (is on, is before, is after); single choice (is any of, is none of); multiple choice (includes any of, includes all of, includes none of); boolean (is yes, is no). Every type also offers is answered and is not answered. Operators for question types added later are those tickets' work.
- [x] Text comparisons NFC-normalise, trim, and lowercase with locale-independent lowercasing on both sides.
- [x] Every operator except is not answered is false for an unanswered question. A question off the path counts as unanswered even when the renderer still holds a value for it.
- [x] A definition accepts at most 1,000 conditions, at most 100 values in an "any of" list, and at most 500 code points in a text constant.
- [ ] A required question that is off the path does not block submission. The renderer leaves an off-path answer out of the submit body and keeps it on screen, so changing the earlier answer restores it.
- [ ] A reached page whose questions are all off the path is passed over: the respondent never sees it, and it never enters Back's history.
- [ ] Submit and edit reject an off-path answer with 422 `ValidationFailed`. Both use the same path function the renderer uses. That function is exported from `@fb/core` for a custom renderer.
- [ ] Each response records the questions it was shown. Edit replaces that record in the same transaction as the answers. Deleting the response deletes the record, including erasure.
- [ ] Responses collected before this iteration are recorded as shown every question in their version, so their detail still reads each of those questions as shown.
- [ ] The response detail shows each question of the version, in order, as answered (with its display value), skipped (on the path, no answer), or not shown (off the path).
- [x] Draft save stays structural. Publish rejects a condition on a question that is not earlier in the version, an option value the question does not have, an operator or constant that does not fit the question type, and an empty group. Publish reports every problem at once.
- [ ] A draft whose conditions are valid previews along the path they describe. Broken conditions, jumps, and the aggregate not-shown counts are later tickets.
- [ ] Tests cover the path, the operators, path-aware answer validation, and answered / skipped / not shown at the core entry points; the 422, the stored path on submit, edit, and admin read through the HTTP API; hiding, restoring, and passing over pages in the renderer; and editing a show condition in the builder.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

Slice A (`@fb/core` only) is on `iter/03a-core-conditions-and-path`. Server path rows, the 422 through HTTP, the renderer, and the builder UI are later slices. Core behaviour those slices must call:

`@fb/core/definition`

- `CONDITIONS_CAP = 1000`
- `conditionOperators` — one array per `QuestionTypeName`. A new type appends one key in `packages/core/lib/definition/operators.ts`; `definition.ts` fails the build until that key exists. Each entry is `{ id, constant, options?, row?, matches(answer, constant) }`. `constant` is `"none" | "string" | "number" | "date" | "strings"`. `options: true` means every string must be an option value. `row: true` is how a matrix type will declare that a leaf may name a row; no current type sets it.
- Operator ids: text and email `equals`, `does_not_equal`, `contains`, `does_not_contain`; number `equal`, `not_equal`, `less_than`, `at_most`, `greater_than`, `at_least`; date `is_on`, `is_before`, `is_after`; single choice `is_any_of`, `is_none_of`; multiple choice `includes_any_of`, `includes_all_of`, `includes_none_of`; boolean `is_yes`, `is_no`. Every type also has `is_answered` and `is_not_answered`.
- `conditionIssues(definition: FormDefinition): Issue[]` — the standalone publish check (also called from `validateForPublish`). Paths point at the leaf or the empty group. Messages: "This condition reads a question that is not earlier in the form", "This operator does not fit this question", "This operator needs a constant", "This operator takes no constant", "This constant does not fit this operator", "This condition names an option value the question does not have", "This question has no rows", "A condition group cannot be empty". Jump conditions are included. A jump's anchor is the end of its page, so it may read that page. A show condition's anchor is the question itself.
- A leaf may carry optional `row` (1–64). Parse accepts it. Publish rejects it on every current type.
- The 1,000 cap counts leaves in show conditions and jumps, at parse time, path `["questions"]` or `["pages"]`, message "A form has at most 1000 conditions". Groups are not counted. Empty groups still parse. The 100-value and 500-code-point caps stay on the constant schema.

`@fb/core/answers`

- `pathOf(definition: FormDefinition, answers: Answers): FormPath` where `FormPath = { pages: readonly PageView[]; questions: readonly QuestionSnapshot[] }`. Visit order. A reached page with no question on the path is omitted, and its jumps are still taken. Format 2 pages are the definition's own page objects; format 1 is the view from `pagesOf`.
- `nextDestination(definition: FormDefinition, answers: Answers, page: PageView): NextDestination` where `NextDestination = { kind: "page"; page: PageView } | { kind: "end" }`. First matching jump, otherwise the following page, then passing over pages with nothing on the path. A jump target that is not a later page or `"end"` is skipped. This is not the renderer's `{ pageId }` shape: use `page.id`.
- `validateAnswers` keeps `(definition, input) => Result<Answers>`. The strict schema is built from the path only. Off-path keys are rejected. `required`, including must-be-yes, applies only on the path. `buildAnswerSchema` is still the whole version.
- `interpretAnswers(definition, answers, shown: readonly string[]): InterpretedAnswer[]`. `shown` is the stored path, not recomputed. Each row is `{ question, status: "answered" | "skipped" | "not_shown", answer? }`. `answer` is present only when `status` is `"answered"`. `ResponseDetail` passes every question id until the response carries the stored path.

`@fb/core/editing`

- `setShowCondition(definition, questionId, condition: Condition): definition`
- `clearShowCondition(definition, questionId): definition` — drops the key. Missing question throws `RangeError`, as the other ops do. Removing a question does not delete conditions that name it.

Draft evaluation, not publish: a missing question, a question that is not earlier, a row on a type with no rows, or an option value the question does not have reads as unanswered, so only `is_not_answered` holds. An operator or constant that does not fit holds as false (it is not treated as unanswered). An empty `all` holds; an empty `any` does not. Text comparison is NFC, trim, then `toLowerCase()`.

Jump targets are not publish-checked here; ticket 05 owns "not a later page". The path function already skips those targets.
