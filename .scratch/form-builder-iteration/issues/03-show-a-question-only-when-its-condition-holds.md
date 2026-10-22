# 03: Show a question only when its condition holds

**What to build:** A question can carry a show condition over earlier answers, combined with all and any, nested up to three groups, using the operators that fit the existing question types. The condition names question identities and option values. The respondent is asked only when it holds. A required question that is hidden does not block them. An answer that falls off the path stays on screen and is left out of the submission; changing the earlier answer brings it back. A page whose questions are all hidden is passed over. Submit and edit reject an answer that is off the path. The response stores the path it was given, and its detail shows each question as answered, skipped, or not shown. A response collected before this iteration shows every question in its version as shown. The path function is public for a custom renderer. Follow ADR-017. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** 02 (Build and answer page by page)

**Status:** ready-for-agent

- [ ] The builder can set and clear a question's show condition. A condition is an `all` or `any` group, nested at most three levels, or a leaf that names a question identity, an operator, and a constant when the operator needs one. It names question identities and option values, never labels or positions, and it can only read a question earlier in the form.
- [ ] The existing question types offer: text and email (equals, does not equal, contains, does not contain); number (`=` `≠` `<` `≤` `>` `≥`); date (is on, is before, is after); single choice (is any of, is none of); multiple choice (includes any of, includes all of, includes none of); boolean (is yes, is no). Every type also offers is answered and is not answered. Operators for question types added later are those tickets' work.
- [ ] Text comparisons NFC-normalise, trim, and lowercase with locale-independent lowercasing on both sides.
- [ ] Every operator except is not answered is false for an unanswered question. A question off the path counts as unanswered even when the renderer still holds a value for it.
- [ ] A definition accepts at most 1,000 conditions, at most 100 values in an "any of" list, and at most 500 code points in a text constant.
- [ ] A required question that is off the path does not block submission. The renderer leaves an off-path answer out of the submit body and keeps it on screen, so changing the earlier answer restores it.
- [ ] A reached page whose questions are all off the path is passed over: the respondent never sees it, and it never enters Back's history.
- [ ] Submit and edit reject an off-path answer with 422 `ValidationFailed`. Both use the same path function the renderer uses. That function is exported from `@fb/core` for a custom renderer.
- [ ] Each response records the questions it was shown. Edit replaces that record in the same transaction as the answers. Deleting the response deletes the record, including erasure.
- [ ] Responses collected before this iteration are recorded as shown every question in their version, so their detail still reads each of those questions as shown.
- [ ] The response detail shows each question of the version, in order, as answered (with its display value), skipped (on the path, no answer), or not shown (off the path).
- [ ] Draft save stays structural. Publish rejects a condition on a question that is not earlier in the version, an option value the question does not have, an operator or constant that does not fit the question type, and an empty group. Publish reports every problem at once.
- [ ] A draft whose conditions are valid previews along the path they describe. Broken conditions, jumps, and the aggregate not-shown counts are later tickets.
- [ ] Tests cover the path, the operators, path-aware answer validation, and answered / skipped / not shown at the core entry points; the 422, the stored path on submit, edit, and admin read through the HTTP API; hiding, restoring, and passing over pages in the renderer; and editing a show condition in the builder.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
