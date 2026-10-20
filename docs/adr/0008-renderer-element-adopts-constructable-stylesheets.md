# ADR-008: The renderer element adopts constructable stylesheets so it runs under strict host CSPs

- **Status:** Accepted
- **Date:** 2026-10-20

The `<form-renderer>` custom element guarantees that it works under a strict host Content Security Policy. That means no `'unsafe-inline'` or `'unsafe-eval'` anywhere and no style hashes or nonces. The host only allows the bundle's script origin and the API origin. Svelte's custom-element output injects `<style>` elements into the shadow root, and a strict `style-src` blocks them. Svelte can't emit constructable stylesheets yet ([sveltejs/svelte#8988](https://github.com/sveltejs/svelte/issues/8988)).

The element build therefore compiles only a styleless wrapper as the custom element. It compiles the inner components with `css: "external"`, inlines their extracted CSS into the bundle with a small Vite plugin, and adopts it as one shared `CSSStyleSheet` in the wrapper's `extend` hook. Constructable stylesheets aren't subject to CSP. Dev and source-level tests keep Svelte's injected styles, so only tests against the built bundle cover the production path. Static `style` attributes are banned in renderer markup, because they're parsed as inline styles. Once Svelte supports constructable stylesheets, this wiring can be deleted.

## Considered options

- **Require `style-src 'unsafe-inline'` from hosts.** Rejected: it excludes the hardened hosts that embed third-party widgets most carefully, and it undercuts the ADR-001 §3 integration story.
- **Publish a `sha256` hash for each injected stylesheet.** Rejected: hosts would have to update their CSP on every renderer release, and Svelte can change the style text in any release.
