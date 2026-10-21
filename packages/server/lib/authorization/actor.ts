import { Context, Data, Effect, type Option, Schema } from "effect";

export const Capability = Schema.Literals(["forms:manage", "responses:read", "responses:delete"]);
export type Capability = typeof Capability.Type;

/** A tenant comes only from an authenticated actor, so repositories can't be handed a raw string. */
export const TenantId = Schema.String.pipe(Schema.brand("TenantId"));
export type TenantId = typeof TenantId.Type;

export interface ExternalRef {
  readonly namespace: string;
  readonly refId: string;
}

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
const isIdentifier = (text: string) => {
  let codePoints = 0;
  for (const _ of text) if (++codePoints > 255) return false;
  return codePoints >= 1;
};

/** Resolves the request's actor and holds it to the claim limits, whichever resolver produced it. */
export const authenticate = (request: ActorRequest) =>
  ActorResolver.use((resolver) => resolver.resolve(request)).pipe(
    Effect.filterOrFail(
      (actor) =>
        isIdentifier(actor.tenant) && (actor._tag === "Anonymous" || isIdentifier(actor.subject)),
      () => new Unauthenticated({ reason: "invalid" }),
    ),
  );
