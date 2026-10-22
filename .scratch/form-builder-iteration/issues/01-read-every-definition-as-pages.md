# 01: Read every definition as pages

**What to build:** An existing form still opens as one page and still publishes, renders, and collects responses as it does today. Saving the draft stores the page format. The API accepts that format and the original one. A body with no format, or with a field the format does not define, is rejected. Publishing a definition that contains an empty page is rejected. `info.version` takes the one major bump for this iteration, from 0.1.0 to 1.0.0. Follow ADR-017. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] A format-1 definition reads as one page, with no show conditions and no jumps. Reading a stored definition never rewrites it.
- [x] An existing form still publishes, renders as one scrolling page, and collects responses as it does today. Respondent paging is a later ticket.
- [x] Saving a draft in the builder stores format 2: one page holding the questions the draft already had.
- [x] Every endpoint that accepts a definition accepts format 1 and format 2. Formats 1 and 2 share the same question types.
- [x] A definition with no `format`, or with a key the format does not define, is rejected with 422.
- [x] A draft may contain an empty page. Publish rejects an empty page.
- [x] A definition accepts at most 50 pages and at most 200 questions across all of them. Page ids are unique within the definition.
- [x] `info.version` is 1.0.0. The OpenAPI document and the generated client match the API. No later ticket bumps the version again.
- [x] Tests cover parsing and publish at the core entry point, and both formats plus the 422 cases through the HTTP API.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

Readers accept format 1 and format 2. `parseDefinition` keeps the format it was given, so a stored format-1 definition is not rewritten. `pagesOf` reads format 1 as one page (`id: null`, no jumps, no invented show condition). `questionsOf` is the flat display order shared by both formats; the renderer still scrolls every question until ticket 02.

Format 2 is a non-empty `pages` list. A page has an id, an optional title and description, questions, and `jumps` (empty allowed, at most 20). A jump is `{ condition, target }` and `target` is a page id or `"end"`. A question snapshot may carry an optional `showCondition`. The condition tree is structural only: an `all` / `any` group nested at most three levels, or a leaf `{ questionId, operator, constant? }`. Operator meaning, publish-time logic checks, and path evaluation belong to tickets 03 and 05. `IdSource` gains `pageId()`. `upgradeToFormat2` wraps format 1 in one page with a minted id; the builder calls it when it saves a draft. Existing editing operations work on both formats. `moveQuestion` still takes a flat display index and keeps each page's length. Adding, removing, and reordering pages stays with ticket 02.

Caps on read: 50 pages, 200 questions across pages, 20 jumps per page, unique page ids, unique question ids. A draft may hold an empty page. Publish rejects it at `["pages", i, "questions"]`. A format-1 definition with no questions still fails with the existing "at least one question" issue.

`info.version` is 1.0.0. `openapi.json` and the generated client were regenerated and must not be bumped back. Local `vp check`, `vp run boundaries`, `vp run check:svelte`, and `vp test` (696 tests, PGlite and Chromium) passed. `vp run ready` still includes `test:pg` and `e2e`, which this branch does not run; that gate and CI stay with the central merge.
