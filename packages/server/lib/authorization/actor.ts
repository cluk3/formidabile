import { Context, Data, Effect, type Option, Schema } from "effect";

export const Capability = Schema.Literals(["forms:manage", "responses:read", "responses:delete"]);
export type Capability = typeof Capability.Type;

/** A tenant comes only from an authenticated actor, so repositories can't be handed a raw string. */
export const TenantId = Schema.String.pipe(Schema.brand("TenantId"));
export type TenantId = typeof TenantId.Type;

export type Actor = Data.TaggedEnum<{
  Identified: {
    readonly subject: string;
    readonly tenant: TenantId;
    readonly capabilities: ReadonlyArray<Capability>;
    /** Set when the host bound the token to one form. */
    readonly formId: Option.Option<string>;
    readonly refs: ReadonlyArray<ExternalRef>;
  };
  Anonymous: {
    readonly tenant: TenantId;
    readonly formId: string;
    readonly refs: ReadonlyArray<ExternalRef>;
  };
}>;
export const Actor = Data.taggedEnum<Actor>();

export class Unauthenticated extends Schema.TaggedError<Unauthenticated>()(
  "Unauthenticated",
  { reason: Schema.Literals(["missing", "invalid", "identityRequired"]) },
  { httpApiStatus: 401 },
) {}

/** What a resolver sees of a request. `source` is the Fetch `Request` under `createFormModuleHandler`. */
export interface ActorRequest {
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly source: object;
}

/** How the host tells the module who is calling. Fails with `missing` when the request carries no credentials. */
export class ActorResolver extends Context.Service<
  ActorResolver,
  { readonly resolve: (request: ActorRequest) => Effect.Effect<Actor, Unauthenticated> }
>()("@fb/server/ActorResolver") {}

// ADR 0015 counts code points. Effect Schema's length checks count UTF-16 units, so an emoji would count twice.
const codePoints = (min: number, max: number) =>
  Schema.makeFilter<string>(
    (text) => {
      let count = 0;
      for (const _ of text) if (++count > max) return false;
      return count >= min;
    },
    { expected: `${min} to ${max} code points` },
  );

const Identifier = Schema.String.check(codePoints(1, 255));

const FormId = Schema.String.check(Schema.isUUID());

/** An opaque host reference, in the persistence model's shape (the `*_external_refs` check constraints). */
export const ExternalRef = Schema.Struct({
  namespace: Schema.String.check(codePoints(1, 64), Schema.isPattern(/^[a-z][a-z0-9_.-]*$/)),
  refId: Identifier,
}).annotate({ identifier: "ExternalRef" });
export type ExternalRef = typeof ExternalRef.Type;

const Refs = Schema.Array(ExternalRef).check(Schema.isMaxLength(20), Schema.isUnique());

const ValidActor = Schema.Union([
  Schema.Struct({
    _tag: Schema.Literal("Identified"),
    subject: Identifier,
    tenant: Identifier,
    formId: Schema.Option(FormId),
    refs: Refs,
  }).check(
    Schema.makeFilter((actor) => actor.refs.length === 0 || actor.formId._tag === "Some", {
      expected: "refs bound to a form",
    }),
  ),
  Schema.Struct({
    _tag: Schema.Literal("Anonymous"),
    tenant: Identifier,
    formId: FormId,
    refs: Refs,
  }),
]);

const isValidActor = Schema.is(ValidActor);

/** Resolves the request's actor and holds it to the claim limits, whichever resolver produced it. */
export const authenticate = (request: ActorRequest) =>
  ActorResolver.use((resolver) => resolver.resolve(request)).pipe(
    Effect.filterOrFail(
      (actor) => isValidActor(actor),
      () => new Unauthenticated({ reason: "invalid" }),
    ),
  );
