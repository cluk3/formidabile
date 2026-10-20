# Zod 4 alongside Effect Schema

Type: research
Status: resolved
Map: [Form builder MVP](../map.md)

## Question

Zod 4 is the chosen validation library, but Effect v4 has its own Schema used by its HTTP and SQL layers. How do the two coexist, and where can the boundary sit?

Find out:

- Whether Effect v4's HTTP API and SQL layers accept Zod 4 (directly, via Standard Schema, or via an adapter), or require Effect Schema.
- Interop paths in both directions: Zod to Effect Schema, Effect Schema to Standard Schema, and shared JSON Schema output (`z.toJSONSchema` and the Effect equivalent).
- Whether Zod 4 can express what the canonical form definition needs: discriminated unions by question type, extensible type-specific config, refinements, and runtime-built schemas that validate answers against one form version.
- Bundle size and tree-shaking of Zod 4 (and `zod/mini`) for the browser renderer.
- Concrete examples or community patterns of Effect and Zod used together, and pitfalls.

## Answer

Findings: [research/zod-4-and-effect-schema.md](../research/zod-4-and-effect-schema.md), section "Addendum: findings from the first pass". Checked against `effect@4.0.5` and `zod@4.6.7`, with runnable experiments.

- **Effect's HTTP API and SQL layers require Effect Schema.**
  - `HttpApiEndpoint` takes `Schema.Top` everywhere, and `SqlSchema`/`SqlResolver` take `Schema.Constraint`.
  - No Effect module consumes Standard Schema.
  - Raw `sql` queries are unconstrained, so you can validate their rows with Zod by hand.
- **Zod can enter an HttpApi JSON body through a ~20-line adapter.** The adapter is `Schema.Json` with a check whose `toJsonSchema` returns `z.toJSONSchema(zs, { io: "input" })`, then `decodeTo` a declaration that runs `zs.safeParse`.
  - Tested end to end, the handler receives Zod's output and OpenAPI shows Zod's schema.
  - It does not work for params, query or headers ("Missing structural codec for StringTree").
  - Zod `.meta({ id })` `$defs` leave dangling `#/components/schemas` refs.
  - Failed decodes return an empty 400.
- **Interop:**
  - Effect to Standard Schema is built in: `Schema.toStandardSchemaV1` and `toStandardJSONSchemaV1`.
  - Zod schemas implement Standard Schema and Standard JSON Schema natively.
  - JSON Schema bridges in either direction are lossy:
    - `SchemaRepresentation.fromJsonSchemaDocument` drops Zod defaults and strictness.
    - `z.fromJSONSchema` is experimental.
    - Zod refinements never reach JSON Schema.
    - Effect's JSON Schema emits `null` for optional fields.
- **Zod 4 fits the form-definition model.**
  - A discriminated union can be built from a question-type registry.
  - `looseObject` handles extensible config, and `superRefine` with paths handles cross-field rules.
  - Per-version answer schemas can be built with `strictObject` at runtime. That takes about 2 ms for 200 questions; cache per `(formId, version)`.
  - Pitfall: refinements are skipped when inner parsing fails, unless you pass `when`.
  - Pitfall: Zod's `new Function` probe trips strict CSPs, so the embedded renderer should set `z.config({ jitless: true })`.
- **Bundle size for the same schema, gzipped:**
  - `zod` is 27.3 KB.
  - `zod/mini` is 8.2 KB, or 9.3 KB with the `en` locale; Mini has no default locale, so messages are just "Invalid input" without it.
  - Effect `Schema` is 79.2 KB.
- **Community:** opencode built an Effect-to-Zod bridge and later deleted it, with the advice "use Effect Schema directly at HTTP … boundaries".

**Where the boundary sits (recommendation):**

- Effect Schema owns HTTP and SQL contracts: params, query, headers, responses, and error bodies.
- Zod 4 owns the canonical form definition and answer validation, which ship to the browser. Author those in `zod/mini`.
- At the API edge, carry the definition and answers either as `Schema.Json` plus a domain-layer Zod parse, which lets the handler return field errors, or through the JSON-body adapter when OpenAPI should show Zod's schema.
- Don't build a general converter in either direction.

**Confirmed by two later independent passes, with these additions:**

- A Zod adapter's JSON Schema hook only survives on a structural base (`Schema.Json` or `Schema.Record`), never on a `Schema.declareConstructor` declaration, which shows as `{}` in OpenAPI. It must `decodeTo` a type that runs `safeParse`, or Zod defaults are lost.
- `HttpApiMiddleware.layerSchemaErrorTransform` is the documented way to turn the empty 400 into a 422 with field errors.
- Effect#9342 (Standard Schema issues lose nested paths when a filter has a `message`) is fixed on `main` but not released in 4.0.5.
- Drizzle 1.0 beta's `drizzle-orm/effect-schema` targets Effect 3, so `drizzle-orm/zod` is the generator usable with Effect v4.
- Browser code must import `effect/Schema`, never the `effect` barrel (~90 KB versus ~26 KB gzipped).

[Findings](../research/zod-4-and-effect-schema.md)
