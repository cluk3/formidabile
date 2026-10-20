# Zod 4 alongside Effect v4 Schema

Research for [ticket 04](../issues/04-zod-4-alongside-effect-schema.md). Researched 2026-10-19.

## Summary

Effect v4's HTTP API and SQL layers accept **only Effect Schema**. Their type signatures require `Schema.Top` / `Schema.Constraint`, and neither layer has a Standard Schema or Zod entry point. Effect can **export** Standard Schema (`Schema.toStandardSchemaV1`, `Schema.toStandardJSONSchemaV1`), but it cannot **import** one. Zod 4 also has no Standard Schema import.

There are two ways to bridge from Zod into Effect:

- **Wrap the Zod schema** with `Schema.declareConstructor` around `safeParse`. This works, but the result is opaque: OpenAPI shows it as `{}` unless you patch the spec.
- **Go through JSON Schema** with `z.toJSONSchema` followed by `SchemaRepresentation.fromJsonSchemaDocument`. This is lossy: refinements disappear without any error.

Zod 4 can express the canonical form definition well:

- discriminated unions by question type, whose options can be extended;
- per-type config objects;
- `.refine` / `.superRefine` across fields;
- `z.strictObject` answer schemas built at runtime for one form version.

The answer schemas it builds also export clean JSON Schema.

**Recommended boundary:** keep Zod as the canonical definition and answer-validation library in a framework-free domain package that is shared with the browser. Use Effect Schema at the HTTP and SQL edges, where it describes the transport and row shapes. Hand the Zod-validated parts across as opaque JSON, either through a small `declareConstructor` adapter or by validating explicitly inside the handler.

For the browser renderer:

- `zod/mini` is about 5–8 kB gzip.
- Classic `zod@4.6.7` is about 26–28 kB gzip.
- Effect Schema is about 26 kB gzip through `effect/Schema` and about 90 kB through the `effect` barrel.

## Sources

- **[npm]** The npm registry, queried 2026-10-19:
  - `zod` `latest` is `4.6.7`. It was published 2026-10-12, matching the [GitHub release v4.6.7](https://github.com/colinhacks/zod/releases/tag/v4.6.7) (2026-10-12T16:30Z).
  - `effect` `latest` is `4.0.5`, published 2026-10-15. Version `4.0.0` was published 2026-10-01.
  - `@standard-schema/spec` `latest` is `1.1.0`.
  - `@effect/platform` stops at `0.97.2` and `@effect/sql` at `0.52.1`; neither has a 4.x release, so v4's HTTP and SQL schema APIs are the `effect/http-api` and `effect/sql` modules inside `effect` itself.
- **[effect-src]** The published `effect@4.0.5` tarball (`npm pack effect@4.0.5`), which matches tag [`effect@4.0.5`](https://github.com/Effect-TS/effect/tree/effect%404.0.5/packages/effect/src). Paths below are relative to `packages/effect/`.
- **[SCHEMA.md]** [`packages/effect/SCHEMA.md` on `Effect-TS/effect` main at `d84ec3f`](https://github.com/Effect-TS/effect/blob/d84ec3fab0346c01bc59f6624d1c046ca4140087/packages/effect/SCHEMA.md) (2026-10-18).
- **[zod-src]** The published `zod@4.6.7` tarball. Upstream it is tag [`v4.6.7`](https://github.com/colinhacks/zod/tree/v4.6.7/packages/zod).
- **[zod-docs]** The [Zod docs sources on `colinhacks/zod` main](https://github.com/colinhacks/zod/tree/main/packages/docs/content), fetched 2026-10-19. These are the pages behind zod.dev.
- **[exp]** Throwaway experiments in `/tmp/zer/exp`, run with `effect@4.0.5`, `zod@4.6.7`, `esbuild@0.28.2`, `typescript@7.0.2`, on Node 24.20. The code is not in the repo. Results are quoted where used.

## 1. Do Effect v4's HTTP API and SQL layers accept Zod or Standard Schema?

**No. Both require Effect Schema.**

- **`HttpApiEndpoint.make`** (and therefore `get`/`post`/…) constrains its schema parameters to Effect schemas:
  - `params`, `query` and `headers` must be `Schema.Top | Schema.Struct.Fields`.
  - `payload` must be `PayloadConstraintCodecs<Method>`.
  - `error` must be `Schema.Top | ReadonlyArray<Schema.Top>`.
  - The stored endpoint holds `success`/`error` as `ReadonlySet<Schema.Top>`.

  [effect-src `src/http-api/HttpApiEndpoint.ts` L1048–1069, L187–192](https://github.com/Effect-TS/effect/blob/effect%404.0.5/packages/effect/src/http-api/HttpApiEndpoint.ts)
- **`SqlSchema.findAll` / `findOne` / `findOneOption` / `findNonEmpty`** require `Request extends Schema.Constraint` and `Result extends Schema.Constraint`. [effect-src `src/sql/SqlSchema.ts` L35–160](https://github.com/Effect-TS/effect/blob/effect%404.0.5/packages/effect/src/sql/SqlSchema.ts)
- **No inbound Standard Schema adapter exists.**
  - `src/StandardSchema.ts` only vendors the `@standard-schema/spec` 1.1.0 *types* (`StandardTypedV1`, `StandardSchemaV1`, `StandardJSONSchemaV1`). [effect-src `src/StandardSchema.ts` L1–8](https://github.com/Effect-TS/effect/blob/effect%404.0.5/packages/effect/src/StandardSchema.ts)
  - A grep of the whole `effect@4.0.5` source finds only the outbound `toStandardSchemaV1` / `toStandardJSONSchemaV1` (`src/Schema.ts` L1386, L1407). It finds no `fromStandardSchema`, and no reference to Zod apart from a minified Scalar UI bundle. [effect-src]
- **Verified in TypeScript.** Passing a raw Zod schema as `payload` to `HttpApiEndpoint.post`, or as `Request` to `SqlSchema.findAll`, is a type error: `@ts-expect-error` on both lines passes `tsc --strict`. [exp `interop.ts`]
- **Verified at runtime.** Bypassing the types crashes `OpenApi.fromApi` with `TypeError: Cannot read properties of undefined (reading 'encoding')` in `SchemaAST.js`. There is no runtime guard. [exp]
- **Stability.** Every `src/http-api/` file is `@stability unstable`. `Schema.ts` and `StandardSchema.ts` are `@stability stable`. [effect-src file headers; see also [effect-v4-http-api.md](effect-v4-http-api.md) §1]

## 2. Interop paths

### 2a. Zod to Effect Schema

Neither library ships an adapter (see §1). An npm search for "effect zod" on 2026-10-19 returned no Zod↔Effect Schema bridge package. [npm] There are two viable hand-rolled paths.

**(i) Wrap the Zod schema in an Effect declaration.**

- `Schema.declare(is, annotations)` turns a type guard into a schema that succeeds with the *original input*. [effect-src `src/Schema.ts` L579–591]
  - Wrapping `zod.safeParse(u).success` this way **drops Zod's output transforms and defaults**. `{ id: "a" }` decoded as `{ id: "a" }`, not `{ id: "a", required: false }`. [exp `adapter.ts`]
  - It also collapses every error to `Expected <identifier>`. [exp]
- `Schema.declareConstructor<T, E>()([], () => (input, ast, options) => Effect<T, SchemaIssue.Issue>)` lets the parser return Zod's parsed `data`. [effect-src `src/Schema.ts` L513–525] In the experiment:
  - Mapping each Zod issue to `new SchemaIssue.Pointer(path, new SchemaIssue.InvalidValue({ message }))` inside a `SchemaIssue.Composite` kept Zod's defaults, paths and messages.
  - The Standard Schema formatter then printed `{ path: ["id"], message: "Too small: expected string to have >=1 characters" }`.

  [exp `adapter.ts`; constructors in effect-src `src/SchemaIssue.ts` L413, L600, L768]
- **Either way, the schema is opaque to JSON Schema and OpenAPI.**
  - Effect documents that "Opaque declarations without a structural codec are represented by an unconstrained JSON Schema". [effect-src `src/Schema.ts` L17007–17008]
  - Observed: the request body became `$ref: #/components/schemas/FormVersionEncoded` with component `{}`. [exp]
  - The `Declaration` annotations offer `toCodecJson` / `representation` hooks, but no direct `toJsonSchema` override. [effect-src `src/Schema.ts` L17865–17928]
  - Declarations also "need a reviver" to round-trip through `SchemaRepresentation`. [SCHEMA.md §Schema Representation]
- **Workaround for OpenAPI:** `OpenApi.annotations({ transform })` runs a function over the generated spec. [effect-src `src/http-api/OpenApi.ts` L159–216] Injecting `z.toJSONSchema(schema, { target: "openapi-3.0", io: "input" })` into `components.schemas["<Identifier>Encoded"]` produced the correct component. [exp]

**(ii) Translate through JSON Schema.**

- `SchemaRepresentation.fromJsonSchemaDocument(document)` imports a Draft 2020-12 document as a runtime `Schema.Top`. [effect-src `src/SchemaRepresentation.ts` L3150–3155]
  - The docs call it "a best-effort translation, not a guarantee of identical validation or a lossless round trip". [SCHEMA.md §Importing JSON Schema]
  - It rejects `if`/`then`/`else`, `contains`, `unevaluated*`, `$dynamicRef`, non-local `$ref`, and object or array `const`/`enum`. [effect-src `src/SchemaRepresentation.ts` L3120–3140]
- Feeding it `z.toJSONSchema(FormVersion)` decoded valid data, but **accepted a duplicate question id** that Zod's `.superRefine` rejects. `z.toJSONSchema` had dropped the refinement without any error. [exp `interop.ts`]
- Verdict: usable for documentation-grade shapes, but **unsafe as a validation bridge**.

### 2b. Effect Schema to Standard Schema, and into Zod

- `Schema.toStandardSchemaV1(schema, { parseOptions?, ... })` returns the schema with a `~standard` property (vendor `"effect"`) and a `validate` that formats issues with `SchemaIssue.makeFormatterStandardSchemaV1`. [effect-src `src/Schema.ts` L1386–1394; `src/internal/schema/standardSchema.ts` L22–41]
  - Observed output: `{ issues: [{ path: ["formId"], message: "Expected string" }, { path: ["version"], message: "Missing key" }, …] }`. [exp]
- `Schema.toStandardJSONSchemaV1(schema)` adds `~standard.jsonSchema.input/output({ target })`. Targets are `draft-2020-12`, `draft-07` and `openapi-3.0`; anything else throws `Unsupported target`. [effect-src `src/internal/schema/standardSchema.ts` L95–124]
- Effect's own docs use `toStandardSchemaV1` for TanStack Form `validators` and Elysia route schemas. [SCHEMA.md §Integrations → TanStack Form, Elysia]
- **Zod cannot consume a Standard Schema natively.** `zod@4.6.7` exports `toJSONSchema`, `fromJSONSchema`, `compile`, `toZod` and others, but no Standard Schema import. [zod-src `v4/classic/external.d.ts`]
  - `toZod<T>()` is only a type-equality assertion helper. [zod-src `v4/core/util.d.ts` L140]
  - A `z.custom<T>((u) => !std["~standard"].validate(u).issues)` wrapper works, but it loses issue detail and is synchronous-only. [exp]
- **Zod is itself a Standard Schema.** Every Zod 4 schema carries `~standard`, including `jsonSchema` (Standard JSON Schema). [zod-src `v4/core/schemas.d.ts` L112, `v4/core/to-json-schema.d.ts` L142; exp]
  - Zod recommends that libraries accepting arbitrary validators target Standard Schema. [zod-docs `library-authors.mdx` L21–23] Effect has not done this for HttpApi or SQL.

### 2c. Shared JSON Schema output

**Zod: `z.toJSONSchema(schema, params)`** [zod-docs `json-schema.mdx`]

- Default target is Draft 2020-12. Other targets are `draft-07`, `draft-04` and `openapi-3.0` (L155–163).
- `io: "output"` is the default; use `io: "input"` for the input shape of defaults, pipes and coercions (L142–151).
- `unrepresentable: "throw" | "any" | fn` (L226–290); the default is `"throw"`.
- `cycles: "ref" | "throw"` (L300–324).
- `override(ctx)` lets you modify the generated output (L368–392).
- Checks are converted to "their closest JSON Schema equivalent" (L60). Custom `.refine`/`.superRefine` are not representable and were **silently omitted** in the experiment, with no error. [exp]
- Zod also ships `z.fromJSONSchema`, labelled "semi-experimental". [zod-src `v4/classic/from-json-schema.d.ts`]

**Effect: `Schema.toJsonSchemaDocument(schema, options)`** [effect-src `src/Schema.ts` L16990–17049]

- It returns `{ dialect: "draft-2020-12", schema, definitions }`.
- The `JsonSchema` module converts it to draft-07 or draft-04, and to OpenAPI 3.1 for multi-documents. [effect-src `src/JsonSchema.ts` L501–615]
- It is documented as "best-effort … the Effect decoder remains the final authority". [effect-src `src/Schema.ts` L16990–17013]
- Custom JSON Schema extension keywords were the subject of [effect-smol#2260](https://github.com/Effect-TS/effect-smol/issues/2260) (closed 2026-05-24). `Schema.filter` is gone in v4.

**Compatibility.** Both libraries emit Draft 2020-12 by default, and both implement Standard JSON Schema (`~standard.jsonSchema`). A single OpenAPI document can therefore embed Zod output and Effect output side by side. Neither library's JSON Schema can express cross-field refinements.

## 3. Can Zod 4 express the canonical form definition?

**Yes, for every requirement in the ADR** (question type, type-specific config, validation constraints, extensibility, answers validated against an exact version; [ADR 0001](../../../docs/adr/0001-modular-versioned-form-management.md) §§5–7).

- **Discriminated unions by question type.**
  - `z.discriminatedUnion("type", [...])` requires object options with a literal or enum discriminator.
  - It supports nesting.
  - `z.getDiscriminatedOption(union, "text")` returns one option at the type level.

  [zod-docs `api.mdx` L1965–2034]
- **Extensibility.** `.options` exposes the member array. `z.discriminatedUnion("type", [...Question.options, DateQuestion])` built a four-type union from a three-type one. [exp] A future question type is therefore a new object schema plus a registry entry, with no change to the union site.
- **Type-specific config.** Each option carries its own `config: z.object({...})`, and shared fields are spread from a `base` shape. [exp]
- **Refinements.**
  - An object option with `.refine` (min ≤ max at path `["config","max"]`) still worked inside `discriminatedUnion`. [exp]
  - Form-level `.superRefine` with `ctx.addIssue({ path: ["questions", i, "id"] })` caught duplicate ids. [exp]
  - Caveats:
    - `.extend()` throws on a schema with refinements; use `.safeExtend()` instead. [zod-docs `api.mdx` L1393]
    - `.partial()` and deep partials also throw on objects that carry their own refinement. [zod-docs `api.mdx` L1548]
    - Keep refinements at the leaf or top, and compose from unrefined bases.
- **Answer schemas built at runtime for one form version.**
  - Mapping each question to `z.string().max(n)`, `z.enum(options)`, `z.array(z.enum(...)).min(1)`, `z.number().min().max()`, plus `.optional()` when not required, then `z.strictObject(Object.fromEntries(...))`, correctly rejected these cases with paths and codes:
    - an over-long text answer (`too_big`);
    - an unknown option (`invalid_value`);
    - an out-of-range number (`too_big`);
    - an extra key (`unrecognized_keys`).
  - `z.toJSONSchema` of that answer schema produced a clean `additionalProperties: false` document with `maxLength`, `enum`, `minimum`/`maximum` and `required`.

  [exp `interop.ts`]
- **Cost of building schemas at runtime.** In Effect's published benchmark, "Create a schema" costs 83.7 µs for Zod 4.6.2 against 60.1 µs for Effect Schema. Answer schemas should therefore be built once per published version and cached, not rebuilt per request. [SCHEMA.md §Runtime Performance]
- **`z.compile(schema)`** is Zod 4.6's opt-in ahead-of-time compiler for hot paths (claimed "~9x faster"). [zod-docs `compile.mdx` L1–40] It uses `new Function`. In CSP/no-`eval` environments the schema "comes back uncompiled", and `z.config({ jitless: true })` disables global auto-compilation. [zod-docs `compile.mdx` L97, L137–143]

## 4. Bundle size and tree-shaking in the browser

**Zod's documented guidance** [zod-docs `packages/mini.mdx`]

- `zod/mini` is "a tree-shakable variant" with the same functionality, written as functions (`z.optional(x)`, `.check(z.minLength(1))`) instead of methods. Bundlers cannot tree-shake methods (L13–49).
- The documented figures are 2.12 kB vs 5.91 kB gzip for `z.boolean().parse(true)`, and 4.0 kB vs 13.1 kB for a three-field object (L59–87).
- The docs advise "you should probably use regular Zod unless you have uncommonly strict constraints around bundle size" (L93).
- Mini does not auto-load the English locale (L243), so default messages need `z.config(z.locales.en())` or custom messages.
- `zod`'s `package.json` marks only its `compile` entry as side-effectful (`"sideEffects": ["./compile.js", …]`). [zod-src `package.json`]

**Measured on 2026-10-19** with esbuild 0.28.2 (`--bundle --minify --format=esm --platform=browser`), gzip -9. [exp]

| Script | zod 4.6.7 | zod/mini 4.6.7 | zod 4.0.0 | zod/mini 4.0.0 |
| --- | ---: | ---: | ---: | ---: |
| `z.boolean().parse(true)` (the docs' script) | 18.7 kB | 3.6 kB | — | — |
| `z.object({ a: z.string() })` safeParse | 25.9 kB | 5.0 kB | 14.3 kB | 6.3 kB |
| Question discriminated union plus runtime answer builder | 28.1 kB | 8.2 kB | 16.2 kB | 8.5 kB |

| Same as Effect Schema (`effect@4.0.5`) | gzip |
| --- | ---: |
| `import { Schema } from "effect"` (barrel), one-field struct | 89.9 kB |
| `import * as Schema from "effect/Schema"` (direct module), one-field struct | 26.4 kB |
| Barrel import, question union | 90.0 kB |

Observations:

- **Classic Zod has grown.** The minimum for a classic Zod object went from 14.3 kB in 4.0.0 to 25.9 kB in 4.6.7, so the size table in the Zod docs is stale for 4.6. `zod/mini` stayed at about 4–8 kB. [exp]
- **Effect has a barrel pitfall.** Importing from the `effect` barrel cost about 3.4× more than `effect/Schema` under esbuild. `effect`'s `sideEffects` lists only `SchemaJITCompiler/enable`. [effect-src `package.json`] The barrel penalty was observed but not root-caused. [INFERENCE: barrel re-exports defeat esbuild's tree-shaking]

## 5. Real-world patterns and pitfalls

- **Effect's documented integration patterns all go outward** (Effect Schema → Standard Schema): TanStack Form `validators.onChangeAsync: Schema.toStandardSchemaV1(schema)`, and Elysia route schemas via `toStandardSchemaV1(Schema.toCodecJson(schema))`. [SCHEMA.md §Integrations] Effect documents no Zod-into-Effect pattern, and npm has no maintained adapter. [npm search 2026-10-19]
- **Zod's own guidance** is that consumers of arbitrary validators should accept Standard Schema. [zod-docs `library-authors.mdx` L21–23] Effect HttpApi and SQL do not (§1).
- **Pitfalls, all observed in [exp] unless cited:**
  1. `Schema.declare(is)` around Zod silently drops Zod defaults and transforms. Use `declareConstructor` and return `safeParse().data`.
  2. Declared Zod schemas appear as `{}` in OpenAPI. Patch them with `OpenApi.annotations({ transform })` using `z.toJSONSchema(..., { io: "input", target: "openapi-3.0" })`, or keep the HTTP contract in Effect Schema.
  3. `z.toJSONSchema` omits `.refine`/`.superRefine` without an error. Any JSON Schema export, or a re-import via `fromJsonSchemaDocument`, is weaker than the Zod validator, so never validate from the exported JSON Schema alone.
  4. Raw Zod schemas passed to HttpApi crash `OpenApi.fromApi` at runtime if the types are bypassed (`as any`).
  5. Each library keeps its own issue model (`ZodError.issues` vs `SchemaIssue`). Pick one wire format for errors. `Schema.StandardSchemaV1FailureResult` [SCHEMA.md §Sending a FailureResult over the wire] and Zod issues both map onto `{ path, message }`.
  6. Effect's schema compiler is "experimental" and opt-in (`import "effect/schema/SchemaJITCompiler/enable"`) [SCHEMA.md §Experimental schema compilers]. Zod's `z.compile` uses `new Function` [zod-docs `compile.mdx` L97]. Both fall back to interpretation under strict CSP.
  7. Optional discriminators make `.partial()`/deep-partial degrade a discriminated union to a plain `z.union`. [zod-docs `api.mdx` L1548]

## Implications for this project

- **Put the boundary at the domain package.** A framework-free `form-definition` deep module should own the Zod schemas for the canonical definition, the question-type registry, and the `buildAnswerSchema(version)` factory. The builder, the renderer (browser) and the backend all import it. This satisfies the ADR's "builder must operate on the canonical form definition model".
- **Keep the Effect HTTP and SQL edges in Effect Schema.**
  - Endpoint params, query, headers, envelopes and errors use Effect Schema.
  - Row models in `SqlSchema` use Effect Schema too.
  - Fields that carry Zod-owned data (a definition document, an answers map) are typed in Effect as JSON (`Schema.Unknown`/`Schema.Json`), or as a `declareConstructor` Zod wrapper.
  - The domain service validates with Zod inside the handler.
- **Per-version answer validation** should build the Zod schema once when a version is published or first loaded, and cache it by `(formId, version)`, because schema creation costs tens of µs (§3).
- **Renderer bundle.** If the renderer must stay small, author the shared schemas in `zod/mini`. Mini schemas are the same `zod/v4/core` types and interoperate with classic. [INFERENCE from zod-docs `packages/mini.mdx` L35: "exact same functionality"] Otherwise accept roughly 26–28 kB gzip for classic Zod. Never import Effect from the `effect` barrel in browser code.
- **OpenAPI and JSON Schema.** If the published API contract must document the definition and answer shapes, generate those components with `z.toJSONSchema` and merge them through `OpenApi.annotations({ transform })`. Treat them as documentation only, because refinements are lost.
- **dependency-cruiser:** forbid `effect` imports in the domain and renderer packages, and forbid `zod` imports in HTTP/SQL adapter modules except a single `zod-effect` bridge file.

## Open risks

- **Unstable APIs.** HttpApi and `OpenApi` are `@stability unstable`, so `OpenApi.annotations({ transform })` and component naming (`<Identifier>Encoded`) may change in a minor release. Pin `effect` exactly.
- **Bundle size may keep moving.** Classic Zod's minimum grew by about 80% between 4.0.0 and 4.6.7, and future minors may grow further. Re-measure in CI with the real Vite+ build rather than relying on these esbuild numbers.
- **Unexplained Effect barrel penalty.** The cause of the 90 kB vs 26 kB difference was not investigated. It may differ under Vite/Rolldown.
- **No maintained adapter.** The project would own a roughly 15-line `declareConstructor` bridge, and Effect's `Declaration` hooks (`toCodecJson`, `representation`) could change.
- **Two validation libraries on the backend.** This means two issue formats and two mental models. If Effect later adds a Standard Schema import (no issue or PR was found; searched effect-smol issues for "standard schema"/"zod" on 2026-10-19), the bridge could become first-party.
- **CSP.** `z.compile` (and Effect's JIT) require `new Function`. If the host app enforces a strict CSP, both fall back to the interpreter, with lower throughput.

## Additional findings (third pass)

These were verified separately against the same `effect@4.0.5` and `zod@4.6.7`, and do not appear above.

- **`toStandardSchemaV1` modifies the schema you pass in.** It runs `Object.assign(self, { "~standard": … })` and returns the same object; `std === schema` was `true`. A later call on an already-converted object returns it unchanged and ignores the new `leafHook`/`checkHook`/`parseOptions`. Shared built-ins such as `Schema.String` are affected too. [effect-src `src/internal/schema/standardSchema.ts` `toStandardSchemaV1`; [Effect-TS/effect#9298](https://github.com/Effect-TS/effect/issues/9298), closed 2026-10-16, but 4.0.5 still behaves this way] When you need custom options, convert a freshly built schema object.
- **`fromJsonSchemaDocument` rejects common Zod output by default.** [exp]
  - Any `pattern` throws `Patterns may block validation and are disabled. Use patterns: "apply" for trusted schemas…`. Zod emits patterns for `z.email()`, `z.iso.date()` and other string formats, so pass `{ patterns: "apply" }` for trusted Zod output.
  - A recursive Zod schema without an id (getter-based `children: z.array(Section)`) emits `"$ref": "#"`, which throws `Unsupported $ref "#". Use "#/$defs/Name".` Adding `.meta({ id: "Section" })` makes Zod emit `$defs`, and that version imports fine.
  - `z.toJSONSchema(registry)` cross-references with bare `"$ref": "ChoiceOption"`, which is also outside the `#/$defs/<Name>` form the importer accepts. [effect-src `src/SchemaRepresentation.ts` L3120–3148]
- **Effect's string-length JSON Schema is an approximation.** `isMinLength(n)` counts UTF-16 code units at runtime, so for n > 1 it emits a deliberately looser `minLength: ceil(n/2)`. `isMinLength(2)` emitted `minLength: 1`. [effect-src `src/Schema.ts` L8446–8469; [#6336](https://github.com/Effect-TS/effect/issues/6336)] Zod's `.min(2)` emits `minLength: 2` and rejected the one-code-point string `"😀"`, so Zod's runtime check matches its JSON Schema output. [exp] This is another reason to publish definition and answer JSON Schema from Zod only.
- **Duplicate discriminators fail at first parse, not at construction.** `z.discriminatedUnion("type", [a, aAgain])` constructs fine, and the first `.parse` throws `Duplicate discriminator value "a"`. [exp] A registry-built union should be parsed once at start-up (e.g. in a test) so a clash is caught early.
- **The pnpm/Vitest pitfall no longer applies.** [#5948](https://github.com/Effect-TS/effect/issues/5948) (`@standard-schema/spec` failing to resolve under pnpm strict mode with Vitest) was an Effect 3 problem. `effect@4.0.5` has no `dependencies` and vendors the spec types. [effect-src `package.json`, `src/StandardSchema.ts` L1–8]
- **`@effect/sql-drizzle` still targets Effect 3.** Its latest release, `0.51.0`, has peer dependencies `effect ^3.22.0` and `drizzle-orm >=0.43.1 <0.50`. [npm] That matters for [ticket 03](../issues/03-effect-v4-with-drizzle-and-postgres.md).

## Addendum: findings from the first pass

These findings are from an earlier, independent pass, which the first `## Answer` in [ticket 04](../issues/04-zod-4-alongside-effect-schema.md) cites. They were run against the same `effect@4.0.5` / `zod@4.6.7`, on Node 24.20 with esbuild 0.28.2, in a separate scratch directory (`/tmp/zr`). They are labelled **[run]**, and source references use the same `effect/src` paths as above. Only findings that the sections above don't already cover are listed.

### A1. An adapter whose OpenAPI is correct without patching the spec

The `toJsonSchema` hook exists only on **checks** [effect-src `src/internal/schema/toJsonSchemaDocument.ts` L336]. A check's `toJsonSchema` is **ignored on `Schema.Unknown`** (the output stays `{}`) but **honoured on `Schema.Json`** [run]. So the following carries Zod's JSON Schema into OpenAPI directly and hands the handler Zod's parsed output:

```ts
const fromZod = <T extends z.ZodType>(zs: T) => {
  const { $schema, ...jsonSchema }: any = z.toJSONSchema(zs, { target: "draft-2020-12", io: "input" })
  const Out = Schema.declare((u: unknown): u is z.output<T> => true)
  return Schema.Json.check(Schema.makeFilter(() => true, { toJsonSchema: () => jsonSchema })).pipe(
    Schema.decodeTo(Out, {
      decode: SchemaGetter.transformEffect((u) => {
        const r = zs.safeParse(u)
        if (r.success) return Effect.succeed(r.data)
        const issues = r.error.issues.map((i) =>
          new SchemaIssue.Pointer(i.path, new SchemaIssue.InvalidValue({ message: i.message })))
        return Effect.fail(new SchemaIssue.Composite(Out.ast, issues as any, u))
      }),
      encode: SchemaGetter.transform((t) => t as any)
    })
  )
}
```

Tested end to end with `HttpApiEndpoint.post(..., { payload: fromZod(FormDef) })` through `HttpRouter.toWebHandler` [run]:

- The OpenAPI `requestBody` contained Zod's schema.
- A valid body returned 200. The handler got Zod's output: `.default(false)` was applied and the unknown key `extra` was stripped.
- An invalid body returned 400, and the server log showed Zod's messages and paths.

Limits:

- **JSON bodies only.** In `query`, a declaration fails with `Missing structural codec for StringTree`. Docs: "Declarations must provide a structural `toCodecStringTree`, `toCodecJson`, or `toCodec` encoding" [effect-src `src/Schema.ts` doc of `toCodecStringTree`, ~L17221; run]. Params, query and headers must therefore be Effect Schema.
- **`$defs` dangle.** Zod emits `$ref: "#/$defs/X"` plus `$defs` for any schema with `.meta({ id })`. Effect rewrote the refs to `#/components/schemas/X` but left `$defs` inline and `components.schemas` empty [run]. Fixes:
  - Avoid ids on wire schemas.
  - Or pass `metadata: z.registry()`, which drops all metadata, including descriptions ([zod.dev/json-schema](https://zod.dev/json-schema); run).
  - Or hoist `$defs` with an `OpenApi` transform.
- **The client gets no error detail.** "Request decoding failures respond with an empty `400 Bad Request`" [effect-src `src/http-api/HttpApiError.ts` L468–476; run]. This applies to every schema. To give the renderer field-level errors, validate in the handler, or declare an explicit error schema.

### A2. The JSON Schema bridges, in more detail

- **Zod → Effect via `fromJsonSchemaDocument`** [run]:
  - Zod's top-level `$defs` must be moved into `definitions`, otherwise the import fails with `Missing definition "FormDef" for $ref "#/$defs/FormDef"`.
  - Zod's `default: false` did **not** become a decode default, so the import *rejected* input that Zod accepts (`Missing key … ["multiple"]`).
  - `additionalProperties: false` re-exported as `true`.
  - The result is typed `Schema.Top`, so static types are lost.
- **Effect's JSON Schema shape differs from Zod's** [run]:
  - `Schema.optional(x)` becomes `anyOf: [x, { type: "null" }]`, because the JSON codec encodes optionals as `null`.
  - Structs default to `additionalProperties: true`.
  - Diffing the two libraries' output will therefore show spurious differences.
- **Effect → Zod via `z.fromJSONSchema`** [run]:
  - Feeding `Schema.toJsonSchemaDocument(...)` into `z.fromJSONSchema` validated min length, literals and int ranges correctly.
  - `Schema.Date` arrived as plain `{ type: "string" }`.
  - Zod labels `z.fromJSONSchema` experimental ([zod.dev/json-schema](https://zod.dev/json-schema)).
- **Zod JSON Schema throws on some types** unless configured: transforms, `z.date()` and `z.bigint()` throw by default. Use `io: "input"` (which describes a pipe's input side) or `unrepresentable` [run; zod.dev/json-schema].

### A3. Form-model details

- **Registry-built union.** The union was built as `z.discriminatedUnion("type", Object.values(registry).map(t => t.def))`, with an `answer(q)` builder per type. An unknown type fails with `Invalid discriminator value. Expected 'text' | 'choice' | 'rating'` at `questions[i].type` [run].
- **Plugin config.** `z.looseObject({ max })` kept unknown plugin config keys (`{ max: 5, icon: "star" }`) [run].
- **Refinements are skipped when inner parsing fails.** A form-level `superRefine` duplicate-id check did **not** fire while another question had an invalid `type`. Zod's `when` option overrides this: `z.refine(fn, { message, when: (p) => … })` ran despite an inner failure [run]. Publish-time validation that must report every problem at once should run whole-form invariants as a separate pass, or use `when`.
- **Timing for 200 questions** [run]:
  - Parsing the definition plus building the answer schema took about 2.3 ms.
  - The first answer parse took about 4.4 ms (JIT warm-up).
  - 1,000 later parses took about 30 ms (about 0.03 ms each).
  - This supports caching per `(formId, version)`.
- **CSP probe.** Classic object parsing uses a `new Function` fast path, gated by `allowsEval` [zod-src `v4/core/schemas.js` L1194–1211]. Even if the renderer never calls `z.compile`, the probe itself is reported as a `securitypolicyviolation` under a strict CSP "even though the throw is swallowed", unless `globalConfig.jitless` is set [zod-src `v4/core/util.js` L218–235]. **The embeddable renderer should call `z.config({ jitless: true })`.**

### A4. Bundle and locale details

These were measured on one realistic schema: a three-type discriminated union, a runtime answer builder, a refine and `safeParse`. The build was esbuild 0.28.2 with `--bundle --minify --format=esm --platform=browser`, compressed with gzip -9 [run]:

| Entry | min | gzip |
| --- | ---: | ---: |
| `zod` | 94.3 kB | 27.3 kB |
| `zod` + `z.toJSONSchema` | 99.3 kB | 28.8 kB |
| `zod/mini` | 25.2 kB | 8.2 kB |
| `zod/mini` + `en` locale | 28.3 kB | 9.3 kB |
| Effect `Schema` (barrel `import { Schema } from "effect"`) | 258.3 kB | 79.2 kB |

- **Mini without a locale.** With Mini imported alone, every message is `"Invalid input"`.
- **The locale pitfall.** Importing classic `zod` anywhere in the same process installs `en` globally, which hides that in tests [run].
- **Classic and Mini compose.** A classic `z.object` nested in a Mini `zm.object` validated with correct paths [run]. This confirms the inference in "Implications" above. Any classic schema in the renderer's import graph still pulls in classic's weight.

### A5. SQL and community

- **SQL.** `SqlResolver.ordered`/`grouped`/`findById` also require `Schema.Constraint` [effect-src `src/sql/SqlResolver.ts` L121, L171, L242]. Plain `sql\`...\`` queries are not schema-constrained, so their rows can be validated with Zod by hand.
- **opencode built an Effect-to-Zod bridge, then deleted it.** opencode had `@opencode-ai/core/effect-zod` to keep Zod at its HTTP layer. Commit [e5aa516](https://github.com/anomalyco/opencode/commit/e5aa5161f2317f466cdb5eb2fe97b16120ddded5) (2026-05-12) removed it: 370 lines of bridge and 754 lines of tests. Their migration guide now says: "Use Effect Schema directly at HTTP, tool, and AI SDK boundaries … do not reintroduce generic Effect Schema → Zod conversion".
- **Standard JSON Schema as the neutral hand-off.** [`@colyseus/playground`](https://cdn.jsdelivr.net/npm/@colyseus/playground@0.17.13/src-backend/json-schema.ts) accepts any Standard Schema validator and reads `~standard.jsonSchema.input({ target: "draft-2020-12" })`. Zod ≥ 4.2 provides that natively, and Effect provides it via `toStandardJSONSchemaV1`.

## Addendum: fourth pass (deltas only)

This pass was independent and re-ran the core experiments against `effect@4.0.5` (published 2026-10-15), `zod@4.6.7` (2026-10-12) and `@standard-schema/spec@1.1.0`, on Node 24.20 with esbuild 0.28.2, in `/tmp/zodeffect`. It confirmed the sections above; its results are labelled **[run4]**. Only new findings are listed. Source links are pinned to the release tags [`effect@4.0.5`](https://github.com/Effect-TS/effect/tree/effect%404.0.5/packages/effect) and [`v4.6.7`](https://github.com/colinhacks/zod/tree/v4.6.7/packages/zod).

### D1. Where a JSON Schema hook survives (adapter design)

- **A check on a `Declaration` is dropped.** `declareConstructor(...).check(makeFilter(() => true, { toJsonSchema }))` still compiled to `{}`, and the OpenAPI `requestBody` schema was `{}` [run4]. The compiler returns `{}` for `Declaration` nodes without compiling their checks ([`internal/schema/toJsonSchemaDocument.ts` L428–430](https://github.com/Effect-TS/effect/blob/effect%404.0.5/packages/effect/src/internal/schema/toJsonSchemaDocument.ts#L428-L430)). The hook must therefore sit on a structural encoded side; the JSON Schema is compiled from the canonical JSON codec ([`Schema.ts` L17040–17049](https://github.com/Effect-TS/effect/blob/effect%404.0.5/packages/effect/src/Schema.ts#L17040-L17049)).
- **`Schema.Record(Schema.String, Schema.Unknown)` works as a base too.** It is an alternative to `Schema.Json` when the body must be an object. It emitted `{"type":"object","allOf":[<zod input schema>]}` under `components.schemas.<Identifier>Encoded` [run4].
- **A filter-only adapter drops Zod's output.** The pattern is a base plus a `makeFilter` that calls `zs.safeParse`, with no `decodeTo`. It validates and documents correctly, but decoding returns the *input*. With `version: z.number().int().default(1)`, it decoded `{"title":"x"}`, while the `decodeTo` + `transformEffect` variant decoded `{"title":"x","version":1}` [run4]. The `decodeTo` step is required whenever Zod defaults or transforms matter. One advantage of the filter form: returning `{ path, issue }[]` from the filter keeps Zod's per-field paths in the Effect issue tree ([`Schema.ts` `FilterOutput`](https://github.com/Effect-TS/effect/blob/effect%404.0.5/packages/effect/src/Schema.ts#L6795-L6825)). The output was `duplicate id at ["questions"][1]["id"]` [run4].

### D2. Client-visible validation errors without moving validation into the handler

- **There is a documented way to replace the empty 400.** `HttpApiMiddleware.layerSchemaErrorTransform` intercepts request-decoding `SchemaError`s and can fail with a declared error, for example a `ValidationError` at status 422 with a body ([HTTPAPI.md §Customizing Schema Error Responses](https://github.com/Effect-TS/effect/blob/effect%404.0.5/packages/effect/HTTPAPI.md#customizing-schema-error-responses); [`http-api/HttpApiMiddleware.ts` L489](https://github.com/Effect-TS/effect/blob/effect%404.0.5/packages/effect/src/http-api/HttpApiMiddleware.ts#L489)). Combined with the filter-form paths in D1, this can return Zod field errors through the HttpApi pipeline. [INFERENCE: not run end to end here, because `HttpApiTest` needs the Node platform services.]

### D3. Unreleased Effect fix affecting Standard Schema paths

- **[Effect-TS/effect#9342](https://github.com/Effect-TS/effect/issues/9342):** if a filter has a `message` annotation, the Standard Schema formatter reports the issue at the filter's own path (`path: []`) instead of the nested path it returned. A form library would then show a field error as a form-level error. The issue was reported against `effect@4.0.5` and closed 2026-10-18. npm `latest` is still `4.0.5`, so no release contains the fix yet [npm, 2026-10-19]. This matters only if Effect schemas are exported to the browser through `toStandardSchemaV1`. Avoid `message` annotations on path-reporting filters until a release after 4.0.5.

### D4. Drizzle-generated schemas

- **The Drizzle 1.0 beta ships validators inside `drizzle-orm`.** `drizzle-orm@1.0.0-beta.22` (dist-tag `beta`, modified 2026-10-08; `latest` is still `0.45.4`) exports `./zod`, `./effect-schema`, `./valibot`, `./arktype` and `./typebox` [npm `exports`].
  - `zod` is an optional peer dependency, `^3.25.0 || ^4.0.0`.
  - `./effect-schema` is built against **Effect 3**: `effect` appears only as devDependency `^3.19.8`, and the `.d.ts` files import the v3 names `Array$` and `Schema.BigIntFromSelf` [tarball `package/effect-schema/column.types.d.ts`].
  - Effect 4.0.5's `Schema.ts` has `$Array` and `BigInt` and neither v3 name [effect-src grep].
  - So with Effect v4, `drizzle-orm/zod` is the generator that type-checks today, and `drizzle-orm/effect-schema` does not [INFERENCE from the types; not compiled]. The `@effect/sql-drizzle` Effect-3 finding above points the same way.

### D5. Zod packaging details

- **The locale-bundling bug is fixed.** [colinhacks/zod#6050](https://github.com/colinhacks/zod/issues/6050) reported that `export * as locales` pulled every locale (~175 KB) into webpack/Next bundles. It was closed 2026-08-14 by commit `784e5c2` ("let bundlers tree-shake locales out of the default import"). Classic now registers `en` lazily on the first `ZodType` construction, and only when no locale is set ([`src/v4/classic/schemas.ts` L13–15](https://github.com/colinhacks/zod/blob/v4.6.7/packages/zod/src/v4/classic/schemas.ts#L13-L15)).
- **Bundle sizes measured with esbuild** (`--bundle --minify --format=esm --platform=browser`), for the same two-type question union plus a runtime answer schema [run4]. These agree with A4 above to within ~0.5 KB:

| Bundle | min | gzip |
| --- | ---: | ---: |
| `zod` | 93.9 KB | 27.2 KB |
| `zod` + `z.toJSONSchema` | 99.0 KB | 28.7 KB |
| `zod/mini` | 24.1 KB | 7.8 KB |
| `zod/mini` + `en` locale | 27.2 KB | 8.9 KB |
| `zod/mini` + `z.toJSONSchema` | 46.0 KB | 14.6 KB |
| Effect `Schema` (equivalent) | 257.8 KB | 79.1 KB |

  `toJSONSchema` nearly doubles a Mini bundle, so keep JSON Schema generation server-side.

- **`zod/compile` (new in the 4.6 line).** A side-effect import compiles every schema built after it into a generated fast path for forward parsing. Encode, async and `skipChecks` keep using the runtime parser, and the compiler falls back silently when a schema is unsupported. It is the only `sideEffects` entry in Zod's `package.json` ([`src/compile.ts`](https://github.com/colinhacks/zod/blob/v4.6.7/packages/zod/src/compile.ts); [`src/v4/core/compile.ts` L110–126](https://github.com/colinhacks/zod/blob/v4.6.7/packages/zod/src/v4/core/compile.ts#L110-L126)). It uses `new Function` and honours `z.config({ jitless: true })` (`src/compile.ts` L31–32), so the CSP advice above still applies. It could help the cached per-version answer schemas on the server; the browser renderer should not use it.
