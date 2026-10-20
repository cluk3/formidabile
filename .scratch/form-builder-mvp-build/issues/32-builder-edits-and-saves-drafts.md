# 32: Builder edits and saves drafts for all seven question types

**What to build:** An editor edits a form's draft with all seven question types, reorders questions from the keyboard, and saves explicitly. Every definition change goes through core's editing operations, so the builder never invents its own rules.

**Sources:** [Spec, phase 3](../../form-builder-mvp/spec.md#phase-3-builder); [ADR 0005](../../../docs/adr/0005-form-definition-model.md) (editing rules), [ADR 0009](../../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md); [Definition and persistence defects](../../form-builder-mvp/issues/27-definition-and-persistence-defects.md) (the id source), [Frontend framework and renderer embedding strategy](../../form-builder-mvp/issues/06-frontend-framework-and-renderer-embedding-strategy.md).

**Blocked by:** 08 (Draft editing operations), 11 (Save drafts and publish immutable versions), 31 (Builder signs in, lists and creates forms).

**Status:** ready-for-agent

- [ ] All seven editor components are registered with `satisfies` against core's question types.
- [ ] Every definition change goes through core's editing operations, including `reidentifyQuestion`, with an id source built on Web Crypto.
- [ ] Move-up and move-down buttons reorder questions, and keyboard focus follows the moved question (component test).
- [ ] Save is explicit. On `RevisionConflict` the editor chooses to reload or stay.
- [ ] Component test: a 413 shows "This form is too large to save".
- [ ] An unknown outcome on save uses the shared handling from ticket 31.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
