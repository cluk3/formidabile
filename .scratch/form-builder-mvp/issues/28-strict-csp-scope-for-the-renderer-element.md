# Strict-CSP scope for the renderer element

Type: grilling
Status: resolved
Map: [Form builder MVP](../map.md)

## Question

Does the MVP need `<form-renderer>` to work under a strict host CSP, and if so, does that have to land in phase 0?

- [ADR 0008](../../../docs/adr/0008-renderer-element-adopts-constructable-stylesheets.md) guarantees it: no `'unsafe-inline'`, no hashes or nonces, plus Trusted Types support.
- [ADR 0001](../../../docs/adr/0001-modular-versioned-form-management.md) asks for a renderer that any host can embed, but names no CSP requirement, and no host with that policy exists yet.
- The cost is all in phase 0, before any domain code: a custom Vite plugin that rewrites the bundle, a wrapper `extend` hook that relies on an undocumented Svelte internal, a test banning static `style` attributes, and a three-browser Playwright test.

Options to weigh:

- Keep ADR 0008 and phase 0 as they are.
- Keep the guarantee, but build it after the first renderer slice in phase 2, once there's a real renderer to style.
- Drop the guarantee for the MVP, document `style-src 'unsafe-inline'` as a host requirement, and supersede ADR 0008.

Decide, and say what changes in ADR 0008, [Renderer styles under strict host CSPs](./14-renderer-styles-under-strict-host-csps.md) and the spec's phase 0.

## Answer

Keep ADR 0008 and phase 0 as they are. No new ADR, and nothing in ADR 0008, [Renderer styles under strict host CSPs](./14-renderer-styles-under-strict-host-csps.md) or `spec.md` changes.

- **Guarantee**: `<form-renderer>` keeps working under a strict host CSP in the MVP, Trusted Types included. ADR 0001 §3.3 asks for embedding in existing applications without assumptions about their deployment environment, and requiring `style-src 'unsafe-inline'` would be such an assumption.
- **Timing**: phase 0, on the placeholder. The constructable-stylesheet plugin and the wrapper's `extend` hook are build pipeline, and the spec's rule is that later phases add content, never pipeline. Deferring to phase 2 would change the element build in the same slice that writes all seven question components.
- **Cost accepted**: the spike already built the mechanism in about 49 lines and passed in Chromium, Firefox and WebKit, with a slightly smaller bundle. The static-`style` ban costs least when it applies from the first line of renderer markup; retrofitting it would mean auditing every component.
- **Risk accepted**: the one undocumented Svelte internal (`attachShadow` in the `SvelteElement` constructor) fails loudly, through the wrapper's named error and the Vitest test against `dist/form-renderer.js`, never silently.
- **Rejected**: building it after the first renderer slice in phase 2, and dropping the guarantee in favour of a documented `'unsafe-inline'` host requirement.
- **Map**: no new tickets and no fog cleared. [Revise the phased plan and spec](./30-revise-the-phased-plan-and-spec.md) has nothing to fold in from this ticket.
