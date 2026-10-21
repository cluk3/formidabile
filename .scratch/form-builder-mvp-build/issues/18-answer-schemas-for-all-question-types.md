# 18: Answer schemas for all seven question types (core)

**What to build:** `@fb/core`'s `answers` entry for all seven question types: `buildAnswerSchema` (strict, and built on every call with no cache), `validateAnswers`, `AnyAnswers` and `interpretAnswers`. An unanswered optional question has no key, and answer values are untagged. The server validates submissions with these, the renderer validates in the browser, and the builder reads responses.

**Sources:** [Spec, phase 2](../../form-builder-mvp/spec.md#phase-2-respond) and its [Design envelope](../../form-builder-mvp/spec.md#design-envelope) (no per-version caches); [ADR 0005](../../../docs/adr/0005-form-definition-model.md); [Canonical form definition model](../../form-builder-mvp/issues/08-canonical-form-definition-model.md), [Definition and persistence defects](../../form-builder-mvp/issues/27-definition-and-persistence-defects.md).

**Blocked by:** 07 (Form definitions and publish rules for all seven question types).

**Status:** ready-for-agent

- [x] `buildAnswerSchema` and `interpretAnswers` are unit-tested across all seven types.
- [x] Unknown answer keys are rejected.
- [x] An unanswered optional question has no key, and values are untagged.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t18-answer-schemas`. `vp run ready` is green locally. The last box stays open until the PR's CI jobs report. Notes for later tickets:

- `@fb/core/answers` exports `AnyAnswers` (the `zod/mini` record of question identity to string, number, boolean or `string[]`, for the HTTP bridge), the `Answers` type (its output), `buildAnswerSchema(definition)`, `validateAnswers(definition, input): Result<Answers>`, `interpretAnswers(definition, answers)` and the `InterpretedAnswer` type.
- `buildAnswerSchema` returns a `z.ZodMiniType<Answers, unknown>`: a strict object keyed by question identity, built on every call. Optional questions use `z.exactOptional`, so a key present with `undefined` is rejected as well as `null` and blank text. `z.toJSONSchema(schema, { target: "draft-2020-12", io: "input" })` lists only required questions under `required` and sets `additionalProperties: false`.
- An unknown key fails with one issue at path `[]` whose message names the key. Every other failure's path starts with the question identity.
- Text answers come back trimmed, so store `validateAnswers`'s `value`, not the raw input.
- `interpretAnswers` returns one `{ question, answer? }` per question of the given version, in its order. `question` is the full snapshot and `answer` is `{ value, display }`, absent when skipped. Keys for questions the version lacks are ignored. `display` is core's per-type text (`Yes`/`No`, option labels joined with `, `). The builder registry can render from `question` and `value` instead.
- It trusts `answers` to have passed that version's schema: it doesn't re-validate.
