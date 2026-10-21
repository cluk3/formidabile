# 08: Draft editing operations (core)

**What to build:** `@fb/core`'s `editing` entry: `addQuestion`, `changeQuestionType`, `moveQuestion`, `addOption`, `removeOption` and `reidentifyQuestion`, as pure functions over a form definition. The minting functions take an id source shaped `{ questionId(): string; optionValue(): string }`, so tests are deterministic and the builder can supply Web Crypto later. The builder is their only caller, from phase 3.

**Sources:** [Spec, phase 1](../../form-builder-mvp/spec.md#phase-1-author-and-publish-through-the-api); [ADR 0005](../../../docs/adr/0005-form-definition-model.md), [ADR 0009](../../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md); [Canonical form definition model](../../form-builder-mvp/issues/08-canonical-form-definition-model.md), [Definition and persistence defects](../../form-builder-mvp/issues/27-definition-and-persistence-defects.md).

**Blocked by:** 07 (Form definitions and publish rules for all seven question types).

**Status:** ready-for-agent

- [x] Every editing function is unit-tested with a deterministic id source.
- [x] `reidentifyQuestion` gives a question a new question identity, as ADR 0009 describes.
- [x] Every function's output passes `parseDefinition`.
- [x] Core still has no envelope types and no `draftFrom`.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t08-draft-editing`. Notes for later tickets (32 especially):

- `@fb/core/editing` exports `addQuestion(def, type, ids)`, `changeQuestionType(def, id, type, ids)`, `moveQuestion(def, id, to)`, `addOption(def, id, ids)`, `removeOption(def, id, value)`, `reidentifyQuestion(def, id, ids)` and the `IdSource` type. Each returns a new definition and never mutates its input. Labels, descriptions, the required flag, the title and type-specific config aren't editing functions: the builder sets those fields directly.
- New questions are blank (empty label, not required). Choice questions start with as many blank options as publish needs: two for single choice, one for multiple choice. `changeQuestionType` keeps the label, description, required flag and position, keeps the options between the two choice types (topped up to that minimum with minted values), and resets the rest of the config. Changing to the same type returns the definition unchanged, identity kept.
- `moveQuestion` takes a target index, so move up and move down are `index - 1` and `index + 1`.
- Caller errors throw a `RangeError`: an unknown question identity or option value, a position outside the form, options on a non-choice question, or going past the question cap (200) or the option cap (100). The builder disables those actions instead of catching.
- The 200-question cap is now `QUESTIONS_CAP` in `lib/definition/form-definition.ts`, next to the existing `OPTIONS_CAP`. Neither is exported from an entry point.
