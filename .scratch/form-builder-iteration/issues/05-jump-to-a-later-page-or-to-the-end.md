# 05: Jump to a later page or to the end

**What to build:** A page can carry an ordered list of jumps. The first match wins; otherwise the next page follows. A jump can read questions on its own page, and its target is a later page or the end of the form. The end means submit. The button reads Submit when the current answers end the form on this page, including an early end, and updates as the respondent answers. A jump whose target was deleted or moved earlier stays, marked broken, and publish refuses it. Preview skips a broken jump. The builder warns, and still allows publish, when it can see that a question or a page cannot be reached. The advisory answer schema marks a question required only when it is required on every path. Follow ADR-017. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** 03 (Show a question only when its condition holds)

**Status:** ready-for-agent

- [x] The builder can add, remove, reorder, and edit a page's jumps. A page accepts at most 20 jumps.
- [x] Jumps are checked in order when the respondent clicks Next. The first whose condition holds is taken. If none holds, the next page follows.
- [x] A jump reads questions on its own page and on earlier pages. Its target is a later page id or the end of the form. The end submits, with the same completion behaviour as finishing the form.
- [x] A destination page whose questions are all off the path is passed over, and its jumps are checked as if Next were clicked there, until the respondent lands on a page with something to answer or the form ends.
- [x] The button reads Submit when the current answers would end the form from this page, and Next otherwise, and it updates as the respondent answers. Next validates the current page's on-path questions. Submit validates the whole path.
- [x] Back returns through the visited pages and does not re-run jumps. Edit mode opens on the first page and re-checks jumps against the edited answers.
- [x] Deleting a jump's target page, or moving that page so it is no longer later, leaves the jump in place and marked broken. Publish refuses a broken jump, a jump whose target is not a later page or the end, and an empty jump condition. Preview skips a jump with an invalid target and continues with the next jump or the next page.
- [x] The builder warns when it can see that a question or a page cannot be reached. The minimum case is an `all` group that requires a question to satisfy both an operator and its complement. The warning never blocks publish. Publish has no reachability rule.
- [x] The advisory answer schema lists a question as `required` only when it is required, has no show condition, and sits on a page no jump can pass over. Every other question is optional in that schema. The server's check stays final.
- [x] Tests cover next-destination order, passing over pages, and broken-jump tolerance at the core entry point; jump editing, the broken marker, and the unreachability warning in the builder; the Submit / Next label in the renderer; and the advisory `required` rule through the HTTP API, including the existing contract that runs the same cases through a generic validator.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

`nextDestination` and `pathOf` already take the first matching jump, pass over a page with nothing on the path, and skip a target that is not a later page or `"end"`. This ticket adds the publish check, the editing operations, and the warning. The renderer already labels the button from `nextDestination`, so an early end reads Submit and updates as the drafts change. Next still validates the current page; Submit still validates the whole path. Back pops history and does not call `nextDestination`. Edit mode starts on the first page and uses the same walk.

`@fb/core/definition`

- `jumpIssues(definition): Issue[]` — a jump whose target is not a later page or `"end"`. Path `["pages", pageIndex, "jumps", jumpIndex, "target"]`, message "This jump does not go to a later page or the end". Format 1 returns none. `validateForPublish` appends these after `conditionIssues`. An empty jump condition is still that condition check ("A condition group cannot be empty"). A jump may read questions on its own page; the anchor stays the end of the page.
- `reachabilityWarnings(definition): Issue[]` — not a publish error. Message "This question cannot be reached" at the question path, and "This page cannot be reached" at `["pages", pageIndex]` (or `["questions"]` for format 1) when every question on the page is unreachable. The minimum case is an `all` group that forces one question to satisfy an operator and its complement, including through nested `all` groups and an `any` whose every branch is impossible. Complements are the same question, the same row, and the same constant: `equals`/`does_not_equal`, `contains`/`does_not_contain`, `equal`/`not_equal`, `less_than`/`at_least`, `greater_than`/`at_most`, `is_any_of`/`is_none_of`, `includes_any_of`/`includes_none_of`, `is_yes`/`is_no`, `is_answered`/`is_not_answered`. An empty `any` never holds. An empty `all` does, so it is not a warning. A contradictory jump is not a warning: the jump never fires, and later pages stay reachable.

`@fb/core/editing`

- `addJump(definition, pageId, jump)`, `removeJump(definition, pageId, index)`, `moveJump(definition, pageId, from, to)`, `setJump(definition, pageId, index, jump)`. `to` is the index the jump should have afterwards, the same coordinate `movePage` uses. The 21st jump throws `A page has at most 20 jumps`. A bad index throws `No jump ${index} among ${length} jumps`. Format 1 throws `Pages are edited on a format 2 definition`. Removing or moving a page does not delete jumps that name it.

The builder's per-page editor is `apps/builder/src/lib/JumpEditor.svelte`. `ConditionEditor` takes `purpose: "show" | "jump"` (default `"show"`). Jump mode hides "Only show when…" and "Always show". A broken jump stays in the list and is marked Broken from `jumpIssues` and `conditionIssues`. Reachability warnings render in that section and do not block publish.

The advisory answer schema keeps a question in `required` only when it is required, has no show condition, and no jump from an earlier page targets a later page or `"end"` in a way that skips its page. The landing page is not skipped. A target that is not later skips nothing. Conditions are not solved. `info.version` stays `1.0.0`. OpenAPI did not change.
