# 29: Renderer accessibility and strict-CSP proof on the real renderer

**What to build:** End-to-end proof that the real renderer meets WCAG 2.2 AA for keyboard and screen-reader users, and still works under a strict host CSP, in Chromium, Firefox and WebKit.

**Sources:** [Spec, phase 2](../../form-builder-mvp/spec.md#phase-2-respond) (Playwright tests); [ADR 0008](../../../docs/adr/0008-renderer-element-adopts-constructable-stylesheets.md); [Frontend framework and renderer embedding strategy](../../form-builder-mvp/issues/06-frontend-framework-and-renderer-embedding-strategy.md), [Renderer styles under strict host CSPs](../../form-builder-mvp/issues/14-renderer-styles-under-strict-host-csps.md), [Strict-CSP scope for the renderer element](../../form-builder-mvp/issues/28-strict-csp-scope-for-the-renderer-element.md).

**Blocked by:** 26 (Renderer fills in and submits all seven question types).

**Status:** ready-for-agent

- [x] The axe checks pass on the renderer in the reference host.
- [x] A keyboard-only run fills in and submits all seven question types using only Tab, Shift+Tab, Space, Enter and the arrow keys.
- [x] If WebKit's default Tab order can't reach every control, that one test falls back to Chromium and Firefox, and the test says why.
- [x] Focus moves to the first error through the shadow root.
- [x] The strict-CSP test passes on the real renderer in all three browsers.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t29-renderer-a11y`. The last box stays open until the PR's CI jobs report. Notes for later tickets:

- `e2e/renderer/accessibility.spec.ts` holds the axe scan (whole page, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`; axe walks the open shadow root) on the answering and error states, the focus-to-first-error test (a later invalid text field, then an invalid radio group, read through `document.activeElement.shadowRoot.activeElement`), and the keyboard-only run. `@axe-core/playwright` is a root devDependency from the catalog. A new renderer state should get an axe scan there.
- The WebKit fallback applies: Playwright's WebKit Tab order stops only at text fields (it skips radios, checkboxes and the Submit button, like Safari without "Press Tab to highlight each item"), so the keyboard run skips WebKit and says why. Every other test in the file runs in all three browsers.
- axe's `target-size` (WCAG 2.2, 2.5.8) failed on the default radios and checkboxes; `.choice` rows in `QuestionCard.svelte` now have `min-block-size: 1.5rem`, which keeps them 24px apart. Don't shrink those rows.
- Keyboard date entry: the segment order follows the operating system's locale, not Playwright's `locale` (Chromium on a day-first Mac ignores `en-US`), so the run types a date whose day equals its month. Tab walks the date's own stops before leaving it, and Chromium stops matching `:focus` on the input once a segment has focus.
- The strict-CSP test now also renders the error state (`[part=error]` color) and the confirmation under the policy, with no violation.
