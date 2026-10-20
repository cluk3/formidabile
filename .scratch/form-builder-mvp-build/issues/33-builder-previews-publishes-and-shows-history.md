# 33: Builder previews, publishes and shows publication history

**What to build:** An editor previews a draft without ever creating a response, publishes it as a form version, and sees the form's publication history. Edit and publish again, and both versions show in the history.

**Sources:** [Spec, phase 3](../../form-builder-mvp/spec.md#phase-3-builder); [ADR 0003](../../../docs/adr/0003-svelte-renderer-with-two-outputs.md), [ADR 0005](../../../docs/adr/0005-form-definition-model.md); [Frontend framework and renderer embedding strategy](../../form-builder-mvp/issues/06-frontend-framework-and-renderer-embedding-strategy.md).

**Blocked by:** 26 (Renderer fills in and submits all seven question types), 32 (Builder edits and saves drafts).

**Status:** ready-for-agent

- [ ] Preview uses the renderer component's preview mode, which never calls the API.
- [ ] Publishing shows every `ValidationFailed` problem at once.
- [ ] Publication history shows the versions list, reads one version, and indicates the current published version against the outstanding draft.
- [ ] An unknown outcome on publish uses the shared handling from ticket 31.
- [ ] Playwright, builder project: create, edit, preview (asserting no `/respond` request is made), save, publish v1, edit and publish v2, and see both versions in the history.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
