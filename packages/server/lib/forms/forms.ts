import { parseDefinition } from "@fb/core/definition";
import { Context, Effect, Layer, type Schema } from "effect";
import type { Actor } from "../authorization/actor.ts";
import { requireAdminRead, requireCapability } from "../authorization/authorization.ts";
import type { Draft, Form, FormDetail, FormSummary } from "../envelopes.ts";
import {
  type Forbidden,
  FormPublished,
  NotFound,
  RevisionConflict,
  ValidationFailed,
} from "../errors.ts";
import { Database, dieOnDatabaseError } from "../persistence/database.ts";
import { findLockedDraft } from "../persistence/drafts.ts";
import {
  deleteForm,
  findFormDetail,
  insertFormWithDraft,
  listForms,
  lockForm,
} from "../persistence/forms.ts";

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
    /** Deletes a never-published form with its draft, if the draft is still at `expectedRevision`. */
    readonly delete: (
      actor: Actor,
      formId: string,
      expectedRevision: string,
    ) => Effect.Effect<void, Forbidden | NotFound | FormPublished | RevisionConflict>;
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
        delete: Effect.fn("Forms.delete")(function* (actor, formId, expectedRevision) {
          const { tenant } = yield* requireCapability(actor, "forms:manage");
          yield* db
            .transaction(
              (tx) =>
                Effect.gen(function* () {
                  const form = yield* lockForm(tx, tenant, formId);
                  if (form === undefined) return yield* new NotFound();
                  // Once someone else has published, "it's published now" is the useful answer.
                  if (form.currentVersionId !== null) return yield* new FormPublished();
                  const draft = yield* findLockedDraft(tx, form);
                  if (draft?.revision !== expectedRevision) return yield* new RevisionConflict();
                  yield* deleteForm(tx, form);
                }),
              { isolationLevel: "read committed" },
            )
            .pipe(dieOnDatabaseError);
        }),
      });
    }),
  );
}
