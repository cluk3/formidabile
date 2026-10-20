# 29: Renderer accessibility and strict-CSP proof on the real renderer

**What to build:** End-to-end proof that the real renderer meets WCAG 2.2 AA for keyboard and screen-reader users, and still works under a strict host CSP, in Chromium, Firefox and WebKit.

**Sources:** [Spec, phase 2](../../form-builder-mvp/spec.md#phase-2-respond) (Playwright tests); [ADR 0008](../../../docs/adr/0008-renderer-element-adopts-constructable-stylesheets.md); [Frontend framework and renderer embedding strategy](../../form-builder-mvp/issues/06-frontend-framework-and-renderer-embedding-strategy.md), [Renderer styles under strict host CSPs](../../form-builder-mvp/issues/14-renderer-styles-under-strict-host-csps.md), [Strict-CSP scope for the renderer element](../../form-builder-mvp/issues/28-strict-csp-scope-for-the-renderer-element.md).

**Blocked by:** 26 (Renderer fills in and submits all seven question types).

**Status:** ready-for-agent

- [ ] The axe checks pass on the renderer in the reference host.
- [ ] A keyboard-only run fills in and submits all seven question types using only Tab, Shift+Tab, Space, Enter and the arrow keys.
- [ ] If WebKit's default Tab order can't reach every control, that one test falls back to Chromium and Firefox, and the test says why.
- [ ] Focus moves to the first error through the shadow root.
- [ ] The strict-CSP test passes on the real renderer in all three browsers.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
