# 02: Build and answer page by page

**What to build:** The builder shows pages with titles, descriptions, and a "Page N" label where the title is empty. Pages can be reordered, and a question can move to another page with its question identity unchanged. The respondent sees one page at a time. The button reads Submit on the last page and Next before that. Next checks only that page, lists the problems, and focuses the first invalid field. Back returns through the pages they visited. A page change focuses that page's heading. The element emits `pagechange` with the page id and title, and leaves the host document title, history, and URL alone. The screen shows the page's own heading and no running page count. Editing a response starts on the first page with the answers filled in. Follow ADR-017. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** 01 (Read every definition as pages)

**Status:** ready-for-agent

- [ ] The builder can add, remove, and reorder pages, and set a page's title and description. An untitled page is labelled "Page N" in the builder only. The respondent never sees that label.
- [ ] A question can move to another page and position. Its question identity stays the same, so its answers keep combining across versions.
- [ ] Publish refuses an empty page from the builder.
- [ ] The respondent sees one page at a time. The button reads Submit on the last page and Next on every earlier page. A one-page form reads Submit.
- [ ] Next checks only the questions on the current page, lists that page's problems, and focuses the first invalid field.
- [ ] Back returns through the pages the respondent actually visited.
- [ ] On a page change, focus moves to the page title, or to the form title when the page has none. The browser's scroll-to-focus brings it into view. The element makes no scroll call of its own.
- [ ] The element dispatches `pagechange` with `{ pageId, title }`, title null when the page is untitled. The component exposes the same fact as a callback. The element never writes `document.title`, history, or the URL.
- [ ] The respondent is shown the page's own heading and no "page X of Y" count.
- [ ] Edit mode opens on the first page with the stored answers filled in. Preview of a draft walks pages the same way.
- [ ] Builder tests cover page editing and moving a question. Renderer tests cover paging, the button label, per-page validation and focus, Back, `pagechange`, edit mode, and preview. Accessibility coverage includes focus moving to the heading on page change.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
