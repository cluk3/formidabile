# 18: Answer schemas for all seven question types (core)

**What to build:** `@fb/core`'s `answers` entry for all seven question types: `buildAnswerSchema` (strict, and built on every call with no cache), `validateAnswers`, `AnyAnswers` and `interpretAnswers`. An unanswered optional question has no key, and answer values are untagged. The server validates submissions with these, the renderer validates in the browser, and the builder reads responses.

**Sources:** [Spec, phase 2](../../form-builder-mvp/spec.md#phase-2-respond) and its [Design envelope](../../form-builder-mvp/spec.md#design-envelope) (no per-version caches); [ADR 0005](../../../docs/adr/0005-form-definition-model.md); [Canonical form definition model](../../form-builder-mvp/issues/08-canonical-form-definition-model.md), [Definition and persistence defects](../../form-builder-mvp/issues/27-definition-and-persistence-defects.md).

**Blocked by:** 07 (Form definitions and publish rules for all seven question types).

**Status:** ready-for-agent

- [ ] `buildAnswerSchema` and `interpretAnswers` are unit-tested across all seven types.
- [ ] Unknown answer keys are rejected.
- [ ] An unanswered optional question has no key, and values are untagged.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
