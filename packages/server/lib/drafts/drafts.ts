import { parseDefinition } from "@fb/core/definition";
import { Context, Effect, Layer, type Schema } from "effect";
import type { Actor } from "../authorization/actor.ts";
import { requireCapability } from "../authorization/authorization.ts";
import type { Draft } from "../envelopes.ts";
import {
  type Forbidden,
  FormNotPublished,
  NoDraft,
  NotFound,
  RevisionConflict,
  ValidationFailed,
} from "../errors.ts";
import { Database, dieOnDatabaseError } from "../persistence/database.ts";
import {
  deleteDraft,
  findFormDraft,
  findLockedDraft,
  insertDraft,
  updateDraft,
} from "../persistence/drafts.ts";
import { lockForm } from "../persistence/forms.ts";

export interface SaveDraft {
  /** `null` creates the draft, based on the current version. */
  readonly expectedRevision: string | null;
  readonly definition: unknown;
}

export class Drafts extends Context.Service<
  Drafts,
  {
    /** The form's draft, or `null` when it has none. */
    readonly read: (
      actor: Actor,
      formId: string,
    ) => Effect.Effect<Draft | null, Forbidden | NotFound>;
    readonly save: (
      actor: Actor,
      formId: string,
      request: SaveDraft,
    ) => Effect.Effect<Draft, Forbidden | NotFound | ValidationFailed | RevisionConflict | NoDraft>;
    /** A never-published form always keeps its draft: delete the form instead. */
    readonly discard: (
      actor: Actor,
      formId: string,
      expectedRevision: string,
    ) => Effect.Effect<void, Forbidden | NotFound | FormNotPublished | NoDraft | RevisionConflict>;
  }
>()("@fb/server/Drafts") {
  static readonly layer = Layer.effect(
    Drafts,
    Effect.gen(function* () {
      const db = yield* Database;
      return Drafts.of({
        read: Effect.fn("Drafts.read")(function* (actor, formId) {
          const { tenant } = yield* requireCapability(actor, "forms:manage");
          const found = yield* findFormDraft(db, tenant, formId).pipe(Effect.orDie);
          if (found === undefined) return yield* new NotFound();
          return found.draft;
        }),
        save: Effect.fn("Drafts.save")(function* (actor, formId, { expectedRevision, definition }) {
          const { tenant } = yield* requireCapability(actor, "forms:manage");
          const parsed = parseDefinition(definition);
          if (!parsed.ok) return yield* new ValidationFailed({ issues: parsed.issues });
          const json = parsed.value as Schema.Json;
          return yield* db
            .transaction((tx) =>
              Effect.gen(function* () {
                const form = yield* lockForm(tx, tenant, formId);
                if (form === undefined) return yield* new NotFound();
                const draft = yield* findLockedDraft(tx, form);
                if (expectedRevision === null) {
                  if (draft !== undefined) return yield* new RevisionConflict();
                  return yield* insertDraft(tx, form, json);
                }
                if (draft === undefined) return yield* new NoDraft();
                if (draft.revision !== expectedRevision) return yield* new RevisionConflict();
                return yield* updateDraft(tx, form, json);
              }),
            )
            .pipe(dieOnDatabaseError);
        }),
        discard: Effect.fn("Drafts.discard")(function* (actor, formId, expectedRevision) {
          const { tenant } = yield* requireCapability(actor, "forms:manage");
          yield* db
            .transaction((tx) =>
              Effect.gen(function* () {
                const form = yield* lockForm(tx, tenant, formId);
                if (form === undefined) return yield* new NotFound();
                if (form.currentVersionId === null) return yield* new FormNotPublished();
                const draft = yield* findLockedDraft(tx, form);
                if (draft === undefined) return yield* new NoDraft();
                if (draft.revision !== expectedRevision) return yield* new RevisionConflict();
                yield* deleteDraft(tx, form);
              }),
            )
            .pipe(dieOnDatabaseError);
        }),
      });
    }),
  );
}
