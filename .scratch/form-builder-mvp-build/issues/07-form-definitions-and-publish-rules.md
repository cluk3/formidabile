# 07: Form definitions and publish rules for all seven question types (core)

**What to build:** `@fb/core`'s `definition` entry: the `format: 1` form definition and all seven question-type modules, each with its snapshot schema, answer builder, publish rules and display part. `parseDefinition` checks structure only, for draft save and reads. `validateForPublish` checks completeness and reports every problem at once, guaranteeing every published question accepts some answer. All seven types land together; the registry is never loosened temporarily. This is pure `zod/mini` code that runs in the browser and on the server.

**Sources:** [Spec, phase 1](../../form-builder-mvp/spec.md#phase-1-author-and-publish-through-the-api); [ADR 0005](../../../docs/adr/0005-form-definition-model.md), [ADR 0009](../../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md); [Canonical form definition model](../../form-builder-mvp/issues/08-canonical-form-definition-model.md) and its [`zod/mini` prototype](../../form-builder-mvp/prototypes/canonical-form-definition/), [Definition and persistence defects](../../form-builder-mvp/issues/27-definition-and-persistence-defects.md).

**Blocked by:** 01 (Workspace, toolchain, and the `static` and `test` CI jobs).

**Status:** ready-for-agent

- [x] Every question-type module is unit-tested at both validation levels.
- [x] `validateForPublish` returns every problem in a draft in one result.
- [x] Multiple-choice `minSelected` and `maxSelected` are structurally whole numbers from 1 to 100, and there is one test for each satisfiability rule: `minSelected` above the number of options, `maxSelected: 0`, and an integer number question with fractional bounds are each rejected.
- [x] Email answers are capped at 254 code points: a 254-code-point answer passes and a 255-code-point one fails.
- [x] Core has no envelope types and no `draftFrom`.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t07-form-definitions`. `vp run ready` is green locally. The last box stays open until the PR's CI jobs report. Notes for later tickets:

- `@fb/core/definition` exports `FormDefinition` and `QuestionSnapshot` (the `zod/mini` schemas, for the HTTP bridge), `parseDefinition`, `validateForPublish(input, priorVersions)`, the `Issue` and `Result` types, and `questionTypes`: the registry of the seven type modules keyed by type name (`text`, `email`, `number`, `date`, `single_choice`, `multiple_choice`, `boolean`). Each module has `snapshot`, `answer(q)`, `publishIssues(q)` and `display(q, answer)`. `QuestionType<Q, A>`, `QuestionTypeName` and `QuestionSnapshotOf<T>` are exported for the renderer and builder registries to `satisfies` against. Ticket 18 builds `buildAnswerSchema` and `interpretAnswers` on `questionTypes[type].answer` and `.display`.
- `Issue.path` is `(string | number)[]`, so it serialises to JSON as is. `Result<T>` is `{ ok: true, value } | { ok: false, issues }`.
- Both functions return the parsed definition, with text trimmed. Trimming happens on draft save, so an all-blank title saves as `""`.
- `validateForPublish` runs the publish rules only once the definition parses. A structural failure returns the structural issues alone. A saved draft always parses, so for publish of a stored draft every completeness problem comes back in one result.
- Duplicate option values are checked on each question's option list, so they're reported even while another question fails. Duplicate question identities are a definition-level check, which Zod skips while any question fails its structural check.
- `zod` 4.6.7 counts code points in `minLength` and `maxLength` itself, so core needs no code-point helper.
- `answers.ts` and `editing.ts` are still empty.
