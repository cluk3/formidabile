# Frontend framework and renderer embedding strategy

Type: grilling
Status: resolved
Map: [Form builder MVP](../map.md)

## Question

Which frontend framework do the builder and the reference host use, and how is the renderer packaged so that host applications on other frameworks can embed it (ADR 0001 §3.3, §7)?

Options to weigh: a framework-specific component package (e.g. React), a web component, or a headless renderer core (state, validation, visibility) with a thin framework adapter. Also decide whether the builder's preview reuses the renderer as-is.

## Answer

Recorded as [ADR 0003](../../../docs/adr/0003-svelte-renderer-with-two-outputs.md). New glossary terms: builder, renderer.

- **Framework**: Svelte 5, written in TypeScript.
- **Builder**:
  - A standalone SvelteKit app built as a static single-page app (`adapter-static`, `ssr = false`), with no SvelteKit server routes; all data comes from the module's API. Hosts don't embed it; host admins reach it by link or redirect.
  - Data loading uses SvelteKit `load` functions that call the API client, with `invalidate` after each mutation and no query library. The draft being edited lives in local rune state.
  - Drafts are saved only through an explicit Save, with an unsaved-changes guard on navigation.
  - Questions are reordered with move-up and move-down buttons, and keyboard focus follows the moved question.
  - The UI uses Tailwind CSS 4 and shadcn-svelte (Bits UI).
- **Renderer**: one Svelte component tree with two build outputs.
  - The **Svelte component** is consumed from source by the builder and by Svelte hosts.
  - The **`<form-renderer>` custom element** is compiled from the same components with Svelte's custom-element option. Inputs are attributes or properties, and outputs are DOM events.
  - Validation, building answers and the answer schema for each version come from shared code with no framework dependency, the same code the server uses. The renderer only handles presentation and the respondent's interaction.
- **Embedding contract**: the renderer is self-contained.
  - Inputs: the API base URL, a form id, optional external references, an optional response id for edit mode, and a credentials hook (a function property) whose shape [Identity, authorization and tenancy seam](./09-identity-authorization-and-tenancy-seam.md) defines.
  - Amended by [Trust in response external references](./20-trust-in-response-external-references.md) (ADR 0012): there's no external-references input. A response's references come only from the host-signed token.
  - It loads the current published version, or the response's own version in edit mode. It submits or saves edits, handles `version_superseded` by reloading an empty form on the current version, and emits `submitted` (with the response id) and `error` events.
- **Preview**: the builder mounts the Svelte renderer component in preview mode with the draft definition passed in. It validates in the browser only and never submits.
- **Styling**: the custom element renders into shadow DOM with a small default stylesheet. Hosts theme it through `--form-renderer-*` custom properties and `::part()` on the question, label, input, error and submit parts. The Svelte component uses the same scoped styles. The renderer uses no Tailwind.
- **Distribution**: the custom element lives in a workspace package whose build produces one self-contained ES module, with the Svelte runtime and styles included. The reference host imports it through the workspace.
- **Reference host**: a plain TypeScript Vite app with no UI framework that embeds the custom element.
- **Revision conflicts** (draft saves in the builder, response edits in the renderer): explain that someone else saved first and offer two choices: reload the latest version and discard local changes, or stay on the page. There's no merge and no diff view.
- **Accessibility**: the renderer is gated on WCAG 2.2 AA. That means labelled inputs, errors linked to fields with `aria-describedby`, focus moving to the first error on a failed submit, and full keyboard use, checked with axe in Playwright. The builder aims for AA but isn't gated on it.
- **Language**: English only, including the `zod/mini` `en` locale for validation messages.
- **Follow-up**: Svelte compatibility with the Vite+ toolchain wasn't verified. It's filed as [Svelte 5 with Vite+ and the deep-module toolchain](./13-svelte-5-with-vite-plus-and-the-deep-module-toolchain.md).
