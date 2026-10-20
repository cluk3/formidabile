# 07: Form definitions and publish rules for all seven question types (core)

**What to build:** `@fb/core`'s `definition` entry: the `format: 1` form definition and all seven question-type modules, each with its snapshot schema, answer builder, publish rules and display part. `parseDefinition` checks structure only, for draft save and reads. `validateForPublish` checks completeness and reports every problem at once, guaranteeing every published question accepts some answer. All seven types land together; the registry is never loosened temporarily. This is pure `zod/mini` code that runs in the browser and on the server.

**Sources:** [Spec, phase 1](../../form-builder-mvp/spec.md#phase-1-author-and-publish-through-the-api); [ADR 0005](../../../docs/adr/0005-form-definition-model.md), [ADR 0009](../../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md); [Canonical form definition model](../../form-builder-mvp/issues/08-canonical-form-definition-model.md) and its [`zod/mini` prototype](../../form-builder-mvp/prototypes/canonical-form-definition/), [Definition and persistence defects](../../form-builder-mvp/issues/27-definition-and-persistence-defects.md).

**Blocked by:** 01 (Workspace, toolchain, and the `static` and `test` CI jobs).

**Status:** ready-for-agent

- [ ] Every question-type module is unit-tested at both validation levels.
- [ ] `validateForPublish` returns every problem in a draft in one result.
- [ ] Multiple-choice `minSelected` and `maxSelected` are structurally whole numbers from 1 to 100, and there is one test for each satisfiability rule: `minSelected` above the number of options, `maxSelected: 0`, and an integer number question with fractional bounds are each rejected.
- [ ] Email answers are capped at 254 code points: a 254-code-point answer passes and a 255-code-point one fails.
- [ ] Core has no envelope types and no `draftFrom`.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
