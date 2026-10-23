# ADR-017: Show conditions and forward jumps over pages, evaluated by one core function that decides the path

- **Status:** Accepted
- **Date:** 2026-10-22

Forms gain conditional logic of two kinds. Visibility: a question snapshot may carry a show condition. Navigation: a form definition is an ordered list of pages, and each page may carry jumps to a later page or to the end of the form. Both kinds are data inside the versioned definition, as JSON condition trees, so they freeze with the version like everything else (ADR-001 §5). One pure function in `@fb/core` walks a version with a respondent's answers and returns their path: the questions they are shown, in order. The renderer, the server's answer validation, the response views and analytics all use that path, so the browser and the server cannot disagree about what a respondent was shown. The research behind this is in `.scratch/form-builder-iteration/research/conditional-logic-and-branching.md`. This amends ADR-002 (conditional visibility is no longer excluded), ADR-003 (the renderer holds page and path state), ADR-005 (definition format 2 and its publish checks), ADR-009 (not shown is separate from skipped) and ADR-010 (a major `info.version` bump, and the advisory schema's `required`).

The calls a reader is most likely to "fix" by mistake:

- **Conditions are a tree, never a script.** The renderer runs under a CSP with no `'unsafe-eval'` (ADR-008), so JavaScript conditions cannot run there. A string in a grammar the repo owns would mean shipping and maintaining a parser. A tree is validated by the same `zod/mini` schema as the rest of the definition, and it is evaluated by an ordinary function on both sides of the wire.
- **Conditions name question identities, option values and row values, never labels or positions.** Relabelling a question, an option or a matrix row, or reordering them, leaves every condition meaning the same thing. A question identity keeps its type for life (ADR-005), so the operators available on it never change under old responses.
- **The definition is acyclic by construction.** A condition reads only questions earlier in the version, and a jump only goes to a later page or to the end. There are no backward jumps and no restart, so every path ends and publish needs no cycle check. Back retraces the pages the respondent actually visited, and it never re-runs jumps.
- **Show conditions go on questions; pages are reached only by jumps.** A question without a show condition is always shown once its page is reached. There is no "hide when" and no show condition on a page. Every operator has a complement, and skipping a page is a jump over it, so each effect has exactly one way to be written.
- **The jumps leaving a page are an ordered list, and the first match wins.** They are checked when the respondent clicks Next. The first jump whose condition holds is taken, and if none holds the respondent goes to the next page. A jump may read questions on its own page and on earlier pages. "The end" means submit; there is one completion behaviour, with no custom ending screens and no redirects. The host already receives `submitted` and owns what happens next, and a redirect from inside an embedded element would be an open redirect in the module.
- **A reached page whose questions are all off the path is passed over.** It is never shown and never enters Back's history, and its jumps are checked as if the respondent had clicked Next on it. Publish rejects an empty page, but show conditions can still hide everything on one, and a page with only a title and a Next button would ask the respondent to do nothing.
- **Every operator except "is not answered" is false for an unanswered question.** A question off the path counts as unanswered, even if the renderer still holds a value for it. So "does not equal X" requires an answer, and "unanswered, or not X" has to be written with `any`.
- **`required` means required on the path, and an answer off the path is rejected.** `validateAnswers` evaluates the path and builds the strict schema from it. A hidden required question is not demanded, and an answer to a question off the path is a 422, the same as `externalRefs` in a body (ADR-012). The renderer leaves answers that fall off the path out of the submit body. It keeps them locally, so changing the earlier answer back restores them.
- **Each response stores the path it was given.** The server records the path whenever a response is submitted or edited. Analytics reads that record with a plain `GROUP BY` (ADR-007) and never re-runs the evaluator, so the record shows what the respondent actually saw, even after a later fix to the evaluator. A migration fills in the path for existing responses as every question in their version.
- **Not shown is not skipped.** Each question's analytics report three counts: answered, skipped (on the path but unanswered), and not shown (off the path). Respondents who weren't shown a question are left out the way ADR-009 already leaves out versions that didn't have it. Option shares already use answered responses as their base, so they are unchanged.
- **Conditions compare an answer with a constant, never with another answer.** Every type has "is answered" and "is not answered". The other operators are:
  - **Text and email:** equals, does not equal, contains, does not contain.
  - **Number:** `=` `≠` `<` `≤` `>` `≥`.
  - **Date:** is on, is before, is after.
  - **Single choice:** is any of, is none of (option values).
  - **Multiple choice:** includes any of, includes all of, includes none of.
  - **Boolean:** is yes, is no.
  - **The question types added by ADR-018** have their operators listed there. A matrix condition also names a row value.
- **Text comparison doesn't depend on the locale.** Both sides NFC-normalise, trim and lowercase with `toLowerCase()`, never `toLocaleLowerCase()`. The server is the authority, so a respondent's browser locale (Turkish dotted and dotless i, for example) must not change a result.
- **Pages and conditions are definition format 2.** Readers accept format 1 and format 2, and a format-1 definition reads as one page with no conditions. Nothing stored is rewritten. A draft becomes format 2 the next time the builder saves it, which is allowed because drafts are mutable. The API takes a major `info.version` bump: unlike a new question type (ADR-010), a custom renderer that ignores conditions now has submissions rejected. The question types of ADR-018 ship in the same bump.
- **A page id only needs to be unique within its definition.** A jump names its target by page id, never by position. Analytics never groups by page, so a page id has no meaning across versions and isn't an identity. A page may have a title and a description, and the respondent sees them. An untitled page is labelled "Page N" in the builder only.
- **Draft save stays structural; publish checks the logic.** Publish rejects:
  - a condition on a question that isn't earlier in this version;
  - an option value the question doesn't have;
  - an operator or a constant that doesn't fit the question type;
  - an empty condition group;
  - a jump whose target isn't a later page or the end;
  - an empty page.

  A draft may hold a condition on a deleted question while the editor works. Publish adds no reachability rule. ADR-005's "every question accepts at least one answer" stays a statement about the value domain, and a question no path can reach is a builder warning.

- **The builder flags broken conditions and never deletes them.** Deleting a question, moving it below a question whose condition reads it, or removing an option that a condition names leaves the condition in place, marked broken, and publish blocks until it is fixed. Silently deleting logic would make a form show everything. Jumps follow the same rule: deleting the page a jump targets, or reordering pages so the target is no longer later, leaves the jump in place, marked broken. "Treat as a new question" (ADR-009) rewrites the draft's conditions to the new identity.
- **The advisory answer schema marks a question `required` only if it is on every path.** That means the question is required, has no show condition, and sits on a page no jump can pass over. Everything else is optional in the JSON Schema, and the server's check stays final (ADR-010).
- **The renderer shows no "page X of Y".** The total depends on the answers. The button reads "Submit" when the current answers would end the form from this page, and "Next" otherwise, and it updates as the respondent answers. Next validates only the questions on the current page that are on the path. Submit checks the whole path.
- **The element never touches the host page's title, history or URL.** It dispatches `pagechange` with `{ pageId, title }`, and a host that wants a per-page document title or history entry sets it itself. The browser's Back key leaves the host page and loses the answers, which ADR-002 already accepts for a reload. Writing `document.title` would rename the host's page, and pushing history entries would couple the element to the host's router.
- **On a page change, focus moves to the new page's heading.** That is the page title, or the form title when the page has none. The browser's own scroll-to-focus brings it into view, and the element makes no scroll calls of its own. A failed Next lists that page's issues and focuses the first invalid field, as submit does.
- **Editing a response walks the pages again.** Edit mode opens on the first page with the stored answers filled in, and Next re-checks jumps against the edited answers. There is no way to open a page directly.
- **Response views use the stored path.** `interpretAnswers` and the admin response view show each question as answered, skipped or not shown. An edit can fill in a question that wasn't shown only if the edited answers put it back on the path.
- **The path function is public.** `@fb/core` exports it alongside `interpretAnswers`, so a host that writes its own renderer gets the server's behaviour.
- **The path function never fails on a draft.** Preview runs it on drafts, which may hold broken logic. A condition on a question it can't resolve (deleted, not earlier, or naming an option value that no longer exists) reads that question as unanswered. A jump whose target isn't a later page or the end is skipped, so the next jump, or the next page, applies. The builder shows its broken-logic warning beside the preview. A published version has passed publish's checks, so it never reaches this case.
- **The caps bound the evaluator's work, not the body size.** Per definition:
  - at most 50 pages;
  - at most 20 jumps per page;
  - condition groups nested at most 3 levels deep;
  - at most 1,000 conditions;
  - an "any of" list of at most 100 option values (`OPTIONS_CAP`);
  - a text constant of at most 500 code points (ADR-015).

  That is at most about 100,000 comparisons per evaluation. As with the per-question caps (ADR-005, ADR-015), they can't all be reached within the 1 MiB body limit, and the body limit is what bounds size.

## Considered options

- **Visibility only, with navigation later.** Rejected: navigation is in scope for the first release.
- **Jumps to a question in the flat list, as Typeform does.** Rejected: on one scrolling page, a jump only hides the questions between, which is a second way to write what show conditions already say. Pages also give a jump a clear moment to run, when the respondent clicks Next and the answers are final.
- **An expression string with a grammar owned by the repo, as SurveyJS does.** Rejected: it needs a parser in the renderer bundle, and its references have to be validated separately from the zod definition.
- **JavaScript conditions, as Form.io does.** Rejected: they can't run under ADR-008's CSP, and the server would be running a different language from the renderer.
- **Branches keyed to option labels, as Google Forms does.** Rejected: renaming an option would silently change the branch.
- **Silently dropping off-path answers on the server.** Rejected: like `externalRefs`, a stale or tampered client should fail loudly.
- **Re-running the evaluator in analytics.** Rejected: it moves analytics out of SQL, and a later evaluator fix would rewrite what old respondents are said to have seen.
- **Backward jumps and restart.** Rejected: they make the definition cyclic and need a cycle check.
- **Show conditions on pages.** Rejected: on a forward-only path that is the same as a jump over the page.
- **A reachability rule at publish.** Rejected: proving some respondent can reach a question means solving the conditions, and none of the researched products does it.
- **Deferred, each as its own feature:**
  - custom ending screens;
  - redirects;
  - comparing one answer with another;
  - URL parameters and hidden fields as inputs;
  - calculated variables;
  - piping answers into text;
  - a review step before submit;
  - keeping an unfinished attempt across a reload, on the server or in browser storage (ADR-002).
