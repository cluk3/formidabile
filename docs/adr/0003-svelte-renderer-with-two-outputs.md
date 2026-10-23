# ADR-003: Svelte 5, with one renderer shipped as both a component and a custom element

- **Status:** Accepted
- **Date:** 2026-10-19

The builder and the renderer are written in Svelte 5. The builder is a standalone SvelteKit single-page app with no server code, and hosts don't embed it. To meet ADR-001 §3.3 without forcing hosts onto Svelte, the renderer is a single Svelte component tree with two build outputs. The Svelte component serves the builder's preview and any Svelte host. A self-contained `<form-renderer>` custom element in shadow DOM, themed through CSS custom properties and `::part()`, serves every other host.

The renderer is self-contained: given a form id, it loads the version, submits, and applies the ADR-002 consistency and editing rules itself, so hosts can't drift from them. Validation and the answer schema for each version come from shared code with no framework dependency, the same code the server uses, so the renderer only handles presentation and the respondent's interaction.

## Considered options

- **A framework component only.** Rejected: hosts on other frameworks would have to write their own renderer.
- **A separate custom element in Lit or plain DOM.** Rejected: Svelte compiles to a custom element with a runtime of a few KB, so a second UI paradigm would add maintenance for no gain in bundle size.
- **A headless renderer core with one adapter per framework.** Rejected: with no conditional visibility, the renderer has almost no state of its own beyond the shared validation code (amended 2026-10-22, see ADR-017: the renderer now holds the current page and the respondent's history, but the path comes from shared core code, so the rejection stands).
- **A controlled renderer, where the host fetches and submits.** Rejected: every host would have to reimplement the version-consistency and editing rules.
