# 01: Read every definition as pages

**What to build:** An existing form still opens as one page and still publishes, renders, and collects responses as it does today. Saving the draft stores the page format. The API accepts that format and the original one. A body with no format, or with a field the format does not define, is rejected. Publishing a definition that contains an empty page is rejected. `info.version` takes the one major bump for this iteration, from 0.1.0 to 1.0.0. Follow ADR-017. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A format-1 definition reads as one page, with no show conditions and no jumps. Reading a stored definition never rewrites it.
- [ ] An existing form still publishes, renders as one scrolling page, and collects responses as it does today. Respondent paging is a later ticket.
- [ ] Saving a draft in the builder stores format 2: one page holding the questions the draft already had.
- [ ] Every endpoint that accepts a definition accepts format 1 and format 2. Formats 1 and 2 share the same question types.
- [ ] A definition with no `format`, or with a key the format does not define, is rejected with 422.
- [ ] A draft may contain an empty page. Publish rejects an empty page.
- [ ] A definition accepts at most 50 pages and at most 200 questions across all of them. Page ids are unique within the definition.
- [ ] `info.version` is 1.0.0. The OpenAPI document and the generated client match the API. No later ticket bumps the version again.
- [ ] Tests cover parsing and publish at the core entry point, and both formats plus the 422 cases through the HTTP API.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
