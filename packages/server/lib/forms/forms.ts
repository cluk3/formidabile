import { parseDefinition } from "@fb/core/definition";
import { Context, Effect, Layer, type Schema } from "effect";
import type { Actor } from "../authorization/actor.ts";
import { requireAdminRead, requireCapability } from "../authorization/authorization.ts";
import type { Draft, Form, FormDetail, FormSummary } from "../envelopes.ts";
import { type Forbidden, NotFound, ValidationFailed } from "../errors.ts";
import { Database } from "../persistence/database.ts";
import { findFormDetail, insertFormWithDraft, listForms } from "../persistence/forms.ts";

export class Forms extends Context.Service<
  Forms,
  {
    /** Creates a form with its first draft, in the actor's tenant. */
    readonly create: (
      actor: Actor,
      definition: unknown,
    ) => Effect.Effect<
      { readonly form: Form; readonly draft: Draft },
      Forbidden | ValidationFailed
    >;
    /** The tenant's forms, most recently updated first. */
    readonly list: (actor: Actor) => Effect.Effect<ReadonlyArray<FormSummary>, Forbidden>;
    readonly detail: (
      actor: Actor,
      formId: string,
    ) => Effect.Effect<FormDetail, Forbidden | NotFound>;
  }
>()("@fb/server/Forms") {
  static readonly layer = Layer.effect(
    Forms,
    Effect.gen(function* () {
      const db = yield* Database;
      return Forms.of({
        create: Effect.fn("Forms.create")(function* (actor, definition) {
          const { tenant } = yield* requireCapability(actor, "forms:manage");
          const parsed = parseDefinition(definition);
          if (!parsed.ok) return yield* new ValidationFailed({ issues: parsed.issues });
          return yield* insertFormWithDraft(db, tenant, parsed.value as Schema.Json).pipe(
            Effect.orDie,
          );
        }),
        list: Effect.fn("Forms.list")(function* (actor) {
          const { tenant } = yield* requireAdminRead(actor);
          return yield* listForms(db, tenant).pipe(Effect.orDie);
        }),
        detail: Effect.fn("Forms.detail")(function* (actor, formId) {
          const { tenant } = yield* requireAdminRead(actor);
          const detail = yield* findFormDetail(db, tenant, formId).pipe(Effect.orDie);
          if (detail === undefined) return yield* new NotFound();
          return detail;
        }),
      });
    }),
  );
}
