# Canonical form definition model

Type: prototype
Status: resolved
Blocked by: 05, 07
Map: [Form builder MVP](../map.md)

## Question

What is the shape of the canonical form definition shared by the builder, the renderer, and submission validation (ADR 0001 §4, §6)? Prototype it as rough TypeScript and Zod 4 types to react to, covering:

- Form-level configuration, and the draft and form version envelopes.
- Question snapshots: question identity, type discriminator, label, description, required flag, order, validation constraints, type-specific config.
- Choice options with stable option values distinct from labels.
- How a new question type plugs in without redesigning the response system.
- The answer representation per question type, and how an answer schema is derived from one form version.

Uses the question type set from [MVP product calls on the ADR open questions](./05-mvp-product-calls-on-the-adr-open-questions.md) and the Zod/Effect Schema boundary from [How the chosen stack fits together](./07-how-the-chosen-stack-fits-together.md).

## Answer

Prototype: [prototypes/canonical-form-definition](../prototypes/canonical-form-definition/). Run `pnpm walkthrough` there. It type-checks under strict TypeScript 6.0.3 with `zod@4.6.7`. `form-definition.prototype.ts` is the module to lift into the core; the walkthrough is throwaway. The model decisions are recorded as [ADR 0005](../../../docs/adr/0005-form-definition-model.md), and [ADR 0002](../../../docs/adr/0002-mvp-product-calls.md) is amended to seven question types. New glossary term: form definition.

- **Form definition**: the one type a draft edits and a form version freezes, `{ format: 1, title, description?, questions[] }`, written in `zod/mini` as strict objects. Array order is display order.
  - Title and description live only here. The form record has no name of its own; the builder lists a form by its draft title, or else its current version's title.
- **Question snapshot**: `{ id, type, label, description?, required, config }`, a discriminated union on `type`. Descriptions are plain text.
- **Question types (seven)** and their config:
  - **Text**: `display: single_line | multi_line`, and an optional `maxLength` of at most 10,000. Short and long text are one type, like dropdown on single choice.
  - **Email**: no config.
    - Amended by [Request limits and abuse controls](./25-request-limits-and-abuse-controls.md) (ADR 0015): an email answer is at most 254 characters.
  - **Number**: an `integer` flag, and an optional `min` and `max`.
  - **Date**: an optional `min` and `max` as calendar dates (`YYYY-MM-DD`), with no time or time zone.
  - **Single choice**: `options`, and `display: radio | dropdown`.
  - **Multiple choice**: `options`, and an optional `minSelected` and `maxSelected`.
  - **Boolean**: no config. It's a yes/no answer, and required means the respondent must pick one. There's no "must be checked" consent mode.
  - Out of the MVP: regex patterns, placeholders, "Other, please specify", and rich text.
- **Identifiers**: the builder mints them, and editors never type them.
  - A question identity is a UUID.
  - An option value is an opaque random string, never derived from the label. Relabelling keeps it; deleting and re-adding an option gives a new one.
  - Both are unique within a definition.
  - Amended by [Definition and persistence defects](./27-definition-and-persistence-defects.md): core has no `crypto`, so the editing functions that mint take an id source `{ questionId(): string; optionValue(): string }` as an argument. The builder implements it with Web Crypto, and core tests pass a deterministic one.
- **Question type is fixed per identity**: changing a question's type in the builder mints a new identity. Publish rejects an identity whose type differs from its type in any earlier version.
- **Adding a question type**: each type is one module holding its snapshot schema, an `answer(q)` Zod builder, its publish rules, and how an answer displays in the historical view. A new type is a module plus one entry in the union and the registry; answers, storage and the response API don't change. A test should parse the union once, because Zod only reports a duplicate discriminator on first parse.
- **Two levels of validation**:
  - **Draft save, and reading any stored definition**: structure only. That covers types and shapes, unique question identities and option values, and size caps (200 questions, 100 options, 200-character titles and option labels, 500-character question labels, 2,000-character question descriptions, 5,000-character form descriptions).
    - Amended by [Request limits and abuse controls](./25-request-limits-and-abuse-controls.md) (ADR 0015): characters are Unicode code points. A create or draft-save body is at most 1 MiB, so these caps can't all be reached at once, and the model adds no serialized-size cap of its own.
  - **Publish** adds completeness rules: a non-empty title, at least one question, a label on every question, at least two options for single choice and one for multiple choice, unique option labels, minimum no greater than maximum, `maxSelected` no greater than the number of options, and the type-per-identity rule. Every problem is reported at once, with paths, as `ValidationFailed` issues.
  - Amended by [Definition and persistence defects](./27-definition-and-persistence-defects.md): publish guarantees that every question accepts at least one answer, whether or not it's required.
    - Multiple choice: `minSelected` and `maxSelected` are structurally whole numbers from 1 to 100, so `0` no longer parses. Publish also requires `minSelected` to be no greater than the number of options.
    - Number: when `integer` is true, publish requires `min` and `max` to be whole numbers, so a range with no integer in it can't be published.
    - The other five types can't be configured into an empty answer set. Each rule gets one core unit test.
  - Publish rules are never re-run on read, so tightening them later never makes a stored version unreadable.
  - Zod skips the definition-level checks (duplicate identities and option values) while any question fails its structural check, so those duplicates only show up once the rest parses. That's fine for draft save; publish runs its own complete pass.
- **Format number**: `format: 1`. Published versions are never rewritten, so readers accept every format ever written.
- **Answers**: one JSON object keyed by question identity, with untagged values. The response's version says how to read each one.
  - A string for text, email, a date, or a single-choice option value.
  - A number.
  - A boolean.
  - A `string[]` of unique multiple-choice option values, with at least one.
  - An unanswered optional question has no key, and there are no nulls. The core trims text and rejects a blank string; the renderer leaves blank optional fields out.
- **Answer schema for a version**: `buildAnswerSchema(definition)` returns a `z.strictObject` keyed by question identity, optional where the question isn't required, rejecting unknown keys. Build it once per version and cache it (amended by [Expected load and data volumes](./24-expected-load-and-data-volumes.md): built on every use, with no cache). The fixed `AnyAnswers` record documents the request body in OpenAPI ([ADR 0004](../../../docs/adr/0004-two-schema-libraries-and-a-generated-browser-client.md)).
- **Historical view** (ADR 0001 §8.1): `interpretAnswers(definition, answers)` reads a response with its own version's snapshots, in that version's order. A missing key means skipped; questions absent from that version don't appear.
- **Messages**: the core calls `z.config(z.locales.en())`, because `zod/mini` has no default messages.
- **Envelopes**: plain types in the core. The HTTP and SQL edges re-declare them in Effect Schema.
  - Amended by [Definition and persistence defects](./27-definition-and-persistence-defects.md): core has no envelope types and no `draftFrom`. Nothing consumed them, and they had already drifted: `publishedBy` was nullable, and `revision` was a number. Each envelope is declared once, as an Effect Schema in `@fb/server`, and revisions are opaque strings at every layer above persistence. The fields below still describe the envelopes; `publishedBy` is not null.
  - **Form**: id, availability, response limit, current published version id, and timestamps. The response limit is a form setting that can change at any time, like availability, and isn't versioned. Owner or tenant scope is left to [Identity, authorization and tenancy seam](./09-identity-authorization-and-tenancy-seam.md).
  - **Draft**: form id, revision, the version it was based on (null for a never-published form), definition, and last-updated time. A new draft copies the current version's definition as is, so identities and option values carry over.
  - **Form version**: id, form id, number (1, 2, 3… per form), definition, published time, publishing actor, and the version it was derived from.
