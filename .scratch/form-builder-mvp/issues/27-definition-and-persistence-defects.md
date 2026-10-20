# Definition and persistence defects

Type: grilling
Status: resolved
Map: [Form builder MVP](../map.md)

## Question

How is each of these defects, found by the readiness audit, fixed in the decisions before anyone implements them?

- **The question-identity foreign key can't be created.** [Persistence model](./10-persistence-model.md) gives `question_identities` the primary key `(form_id, question_id)`, then has `form_version_questions` reference `(form_id, question_id, type)`. Postgres needs a unique constraint on exactly the referenced columns. Fix it with `UNIQUE (form_id, question_id, type)`, or reference the two-column key and enforce the type another way.
- **Publish accepts questions no answer can satisfy.** [Canonical form definition model](./08-canonical-form-definition-model.md) checks `maxSelected` against the number of options but not `minSelected`. The [prototype](../prototypes/canonical-form-definition/)'s `validateForPublish` accepted a required multiple-choice question with one option and `minSelected: 2`, and every possible answer then failed. The same class includes an integer number question whose range holds no integer (say `min: 1.2`, `max: 1.8`). Decide which unsatisfiable configurations publish rejects.
- **Core can't mint ids under its own boundary.** [Package layout](./11-package-layout.md) limits `@fb/core` to `zod`, `lib: ["ES2024"]` and `types: []`, yet `addQuestion`, `addOption` and `reidentifyQuestion` mint UUIDs and random option values. With those settings neither Web Crypto nor Node's `crypto` is available. Options: inject an id generator, let callers pass ids in, or allow a browser-safe dependency or a declared global.
- **Duplicated contracts have already drifted.** The prototype's `FormVersion.publishedBy` is nullable, while Persistence model makes it not null. Its `Draft.revision` is a number, while [HTTP API surface](./16-http-api-surface.md) sends an opaque string because the sequence can exceed 2^53. Decide whether core keeps the envelope types at all, and how intentionally duplicated contracts (core, Effect Schema, Drizzle, OpenAPI) are checked against each other.

Record each fix in the ticket or ADR it amends (ADR 0005, ADR 0007, Canonical form definition model, Persistence model, Package layout).

## Answer

No new ADR. ADR 0005 gains one sentence, and each fix is recorded as an amendment in the ticket it changes. The [prototype](../prototypes/canonical-form-definition/) is updated to match. `pnpm typecheck` now also checks the liftable module under core's `lib: ["ES2024"]` and `types: []`, and walkthrough scenario 6 shows the unsatisfiable settings being rejected.

- **Question-identity foreign key** ([Persistence model](./10-persistence-model.md)): add `UNIQUE (form_id, question_id, type)` to `question_identities`. The primary key still enforces one type per identity, and the new constraint is only the foreign key's target. Every other composite foreign key in the model already has a matching target. The rejected alternative was referencing the two-column key and checking the type with a trigger.
- **Unsatisfiable questions** ([Canonical form definition model](./08-canonical-form-definition-model.md), ADR 0005): publish guarantees that every question accepts at least one answer, whether or not it's required.
  - Multiple choice: `minSelected` and `maxSelected` are structurally whole numbers from 1 to 100. That also catches `maxSelected: 0`, a case the audit missed. Publish adds `minSelected` ≤ the number of options.
  - Number: with `integer: true`, publish requires whole-number bounds.
  - Text, email, date, single choice and boolean can't be configured into an empty answer set. Each rule gets one core unit test, and there's no example-answer function per type.
- **Minting ids in core** ([Package layout](./11-package-layout.md), Canonical form definition model): `addQuestion`, `changeQuestionType`, `addOption` and `reidentifyQuestion` take an id source `{ questionId(): string; optionValue(): string }`. The builder implements it with Web Crypto, and core tests pass a deterministic one. This was preferred over callers passing ids, because a type change can need a varying number of option values. It was also preferred over declaring a `crypto` global, which hides the environment and makes tests non-deterministic. `crypto.randomUUID()` needs a secure context, and localhost counts as one.
- **Envelopes and duplicated contracts** (Canonical form definition model, Package layout):
  - Core drops `Form`, `Draft`, `FormVersion` and `draftFrom`, which also used `structuredClone`, a global core can't see. Core owns only the definition and the answers.
  - Each envelope is declared once, as an Effect Schema exported from `@fb/server`. `@fb/http-api` uses those schemas directly, and `openapi.json` and `api-client` are generated from them and drift-checked.
  - Revisions are opaque strings above persistence, which converts the `bigint` column.
  - Two declarations stay hand-written. Drizzle is checked against the migrations by `drizzle-kit check`. Drizzle and the Effect Schemas are linked by typed row mappers in `lib/persistence`, which catch a type mismatch or a schema stricter than its column.
  - A schema looser than its column (a nullable field over `NOT NULL`) isn't caught, and that's accepted. It only weakens what clients are promised, never a stored invariant.
- **For Revise the phased plan and spec**: `spec.md` still lists `draftFrom` under core's `editing`, and doesn't mention the id source or the new `UNIQUE` constraint.
