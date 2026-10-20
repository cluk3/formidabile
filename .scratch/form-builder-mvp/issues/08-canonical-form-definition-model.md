# Canonical form definition model

Type: prototype
Status: open
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
