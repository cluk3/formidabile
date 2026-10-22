# 05: Jump to a later page or to the end

**What to build:** A page can carry an ordered list of jumps. The first match wins; otherwise the next page follows. A jump can read questions on its own page, and its target is a later page or the end of the form. The end means submit. The button reads Submit when the current answers end the form on this page, including an early end, and updates as the respondent answers. A jump whose target was deleted or moved earlier stays, marked broken, and publish refuses it. Preview skips a broken jump. The builder warns, and still allows publish, when it can see that a question or a page cannot be reached. The advisory answer schema marks a question required only when it is required on every path. Follow ADR-017. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** 03 (Show a question only when its condition holds)

**Status:** ready-for-agent

- [ ] The builder can add, remove, reorder, and edit a page's jumps. A page accepts at most 20 jumps.
- [ ] Jumps are checked in order when the respondent clicks Next. The first whose condition holds is taken. If none holds, the next page follows.
- [ ] A jump reads questions on its own page and on earlier pages. Its target is a later page id or the end of the form. The end submits, with the same completion behaviour as finishing the form.
- [ ] A destination page whose questions are all off the path is passed over, and its jumps are checked as if Next were clicked there, until the respondent lands on a page with something to answer or the form ends.
- [ ] The button reads Submit when the current answers would end the form from this page, and Next otherwise, and it updates as the respondent answers. Next validates the current page's on-path questions. Submit validates the whole path.
- [ ] Back returns through the visited pages and does not re-run jumps. Edit mode opens on the first page and re-checks jumps against the edited answers.
- [ ] Deleting a jump's target page, or moving that page so it is no longer later, leaves the jump in place and marked broken. Publish refuses a broken jump, a jump whose target is not a later page or the end, and an empty jump condition. Preview skips a jump with an invalid target and continues with the next jump or the next page.
- [ ] The builder warns when it can see that a question or a page cannot be reached. The minimum case is an `all` group that requires a question to satisfy both an operator and its complement. The warning never blocks publish. Publish has no reachability rule.
- [ ] The advisory answer schema lists a question as `required` only when it is required, has no show condition, and sits on a page no jump can pass over. Every other question is optional in that schema. The server's check stays final.
- [ ] Tests cover next-destination order, passing over pages, and broken-jump tolerance at the core entry point; jump editing, the broken marker, and the unreachability warning in the builder; the Submit / Next label in the renderer; and the advisory `required` rule through the HTTP API, including the existing contract that runs the same cases through a generic validator.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
