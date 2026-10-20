# 08: Draft editing operations (core)

**What to build:** `@fb/core`'s `editing` entry: `addQuestion`, `changeQuestionType`, `moveQuestion`, `addOption`, `removeOption` and `reidentifyQuestion`, as pure functions over a form definition. The minting functions take an id source shaped `{ questionId(): string; optionValue(): string }`, so tests are deterministic and the builder can supply Web Crypto later. The builder is their only caller, from phase 3.

**Sources:** [Spec, phase 1](../../form-builder-mvp/spec.md#phase-1-author-and-publish-through-the-api); [ADR 0005](../../../docs/adr/0005-form-definition-model.md), [ADR 0009](../../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md); [Canonical form definition model](../../form-builder-mvp/issues/08-canonical-form-definition-model.md), [Definition and persistence defects](../../form-builder-mvp/issues/27-definition-and-persistence-defects.md).

**Blocked by:** 07 (Form definitions and publish rules for all seven question types).

**Status:** ready-for-agent

- [ ] Every editing function is unit-tested with a deterministic id source.
- [ ] `reidentifyQuestion` gives a question a new question identity, as ADR 0009 describes.
- [ ] Every function's output passes `parseDefinition`.
- [ ] Core still has no envelope types and no `draftFrom`.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
