import { questionsOf, validateForPublish } from "@fb/core/definition";
import { Context, Effect, Layer, type Schema } from "effect";
import type { Actor } from "../authorization/actor.ts";
import { requireAdminRead, requireCapability } from "../authorization/authorization.ts";
import type { Form, FormVersion, VersionSummary } from "../envelopes.ts";
import {
  type Forbidden,
  NoDraft,
  NotFound,
  RevisionConflict,
  ValidationFailed,
} from "../errors.ts";
import { Database, dieOnDatabaseError } from "../persistence/database.ts";
import { deleteDraft, findLockedDraft } from "../persistence/drafts.ts";
import { lockForm } from "../persistence/forms.ts";
import {
  findVersion,
  insertCurrentVersion,
  listVersions,
  storedDefinition,
  versionDefinitions,
} from "../persistence/versions.ts";

export class Publication extends Context.Service<
  Publication,
  {
    /** Publishes the draft as the next version, which becomes current, and deletes the draft. */
    readonly publish: (
      actor: Actor,
      formId: string,
      expectedRevision: string,
    ) => Effect.Effect<
      { readonly form: Form; readonly version: VersionSummary },
      Forbidden | NotFound | NoDraft | RevisionConflict | ValidationFailed
    >;
    /** Newest first. */
    readonly versions: (
      actor: Actor,
      formId: string,
    ) => Effect.Effect<ReadonlyArray<VersionSummary>, Forbidden | NotFound>;
    readonly version: (
      actor: Actor,
      formId: string,
      versionId: string,
    ) => Effect.Effect<FormVersion, Forbidden | NotFound>;
  }
>()("@fb/server/Publication") {
  static readonly layer = Layer.effect(
    Publication,
    Effect.gen(function* () {
      const db = yield* Database;
      return Publication.of({
        publish: Effect.fn("Publication.publish")(function* (actor, formId, expectedRevision) {
          const { tenant, subject } = yield* requireCapability(actor, "forms:manage");
          return yield* db
            .transaction(
              (tx) =>
                Effect.gen(function* () {
                  const form = yield* lockForm(tx, tenant, formId);
                  if (form === undefined) return yield* new NotFound();
                  const draft = yield* findLockedDraft(tx, form);
                  if (draft === undefined) return yield* new NoDraft();
                  if (draft.revision !== expectedRevision) return yield* new RevisionConflict();
                  const prior = yield* versionDefinitions(tx, form);
                  const valid = validateForPublish(draft.definition, prior.map(storedDefinition));
                  if (!valid.ok) return yield* new ValidationFailed({ issues: valid.issues });
                  const published = yield* insertCurrentVersion(tx, form, {
                    definition: valid.value as Schema.Json,
                    questions: questionsOf(valid.value),
                    publishedBy: subject,
                    derivedFromVersionId: draft.basedOnVersionId,
                  });
                  yield* deleteDraft(tx, form);
                  return published;
                }),
              { isolationLevel: "read committed" },
            )
            .pipe(dieOnDatabaseError);
        }),
        versions: Effect.fn("Publication.versions")(function* (actor, formId) {
          const { tenant } = yield* requireAdminRead(actor);
          const versions = yield* listVersions(db, tenant, formId).pipe(Effect.orDie);
          if (versions === undefined) return yield* new NotFound();
          return versions;
        }),
        version: Effect.fn("Publication.version")(function* (actor, formId, versionId) {
          const { tenant } = yield* requireAdminRead(actor);
          const version = yield* findVersion(db, tenant, formId, versionId).pipe(Effect.orDie);
          if (version === undefined) return yield* new NotFound();
          return version;
        }),
      });
    }),
  );
}
