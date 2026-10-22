# 02: Build and answer page by page

**What to build:** The builder shows pages with titles, descriptions, and a "Page N" label where the title is empty. Pages can be reordered, and a question can move to another page with its question identity unchanged. The respondent sees one page at a time. The button reads Submit on the last page and Next before that. Next checks only that page, lists the problems, and focuses the first invalid field. Back returns through the pages they visited. A page change focuses that page's heading. The element emits `pagechange` with the page id and title, and leaves the host document title, history, and URL alone. The screen shows the page's own heading and no running page count. Editing a response starts on the first page with the answers filled in. Follow ADR-017. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** 01 (Read every definition as pages)

**Status:** ready-for-agent

- [x] The builder can add, remove, and reorder pages, and set a page's title and description. An untitled page is labelled "Page N" in the builder only. The respondent never sees that label.
- [x] A question can move to another page and position. Its question identity stays the same, so its answers keep combining across versions.
- [x] Publish refuses an empty page from the builder.
- [x] The respondent sees one page at a time. The button reads Submit on the last page and Next on every earlier page. A one-page form reads Submit.
- [x] Next checks only the questions on the current page, lists that page's problems, and focuses the first invalid field.
- [x] Back returns through the pages the respondent actually visited.
- [x] On a page change, focus moves to the page title, or to the form title when the page has none. The browser's scroll-to-focus brings it into view. The element makes no scroll call of its own.
- [x] The element dispatches `pagechange` with `{ pageId, title }`, title null when the page is untitled. The component exposes the same fact as a callback. The element never writes `document.title`, history, or the URL.
- [x] The respondent is shown the page's own heading and no "page X of Y" count.
- [x] Edit mode opens on the first page with the stored answers filled in. Preview of a draft walks pages the same way.
- [x] Builder tests cover page editing and moving a question. Renderer tests cover paging, the button label, per-page validation and focus, Back, `pagechange`, edit mode, and preview. Accessibility coverage includes focus moving to the heading on page change.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

Page editing lives on `@fb/core/editing`: `addPage`, `removePage`, `movePage`, `setPageTitle`, `setPageDescription`, and `moveQuestionTo`. Those throw on a format-1 definition (`Pages are edited on a format 2 definition`). The builder upgrades once inside the edit, so a page id is minted once. `addQuestion` takes an optional page id and still appends to the last page when it is omitted. `moveQuestion` is unchanged: a flat display index that keeps each page's length. Cross-page moves use `moveQuestionTo`, whose `to` is the index on the destination after removal (the destination's length appends). The question object is the same value, so its identity is unchanged. `removePage` refuses the last page and leaves other pages' jumps in place, even when they name the removed page. `setPageTitle` and `setPageDescription` drop the key for `undefined` or `""`.

The builder UI is `PageList.svelte` and `PageEditor.svelte`. `DraftEditor` renders the list. An untitled page's heading is `Page N` from its current position, builder only. Move up and move down stay inside the page. "Move to page" appends the question to the chosen page. Publish still posts; an empty page comes back as the existing 422 and is shown with the other problems. Nothing short-circuits publish in the browser.

The renderer shows one page. `nextDestination` in `packages/renderer/lib/paging.ts` is the seam for the path function: it already receives `(definition, answers, page)`. Ticket 03 replaces the body with the first matching jump, otherwise the following page, skipping a page with nothing on the path. Until then the next page is the following one, and an empty draft page is shown. Next checks that page via `checkPage` (one temporary page through `checkDrafts`) and lists only its problems. Submit and a server `ValidationFailed` use `checkDrafts` on the whole definition; `revealErrors` moves to the page of the first invalid question and focuses that field. History is the pages left by Next. Back pops it and does not call `nextDestination`. The terminal button is Submit, or "Save changes" / "Saving…" when editing a response, which keeps the existing edit tests. A one-page form reads Submit. Edit mode and a new response start at page 0 with the stored drafts. Preview uses the same walk and does not reset it while the author types.

A page change focuses the page title, or the form title when the trimmed title is empty. That is `focus()` with no `scrollIntoView`. `pagechange` is `{ pageId, title }` (`pageId` null on a format-1 page, `title` null when untitled), dispatched on the element and passed as `onpagechange`. The renderer never writes `document.title`, history, or the URL. There is no "page X of Y".

`vp run ready` includes `test:pg` and CI, which this branch does not run. That checkbox stays open for the central merge.
