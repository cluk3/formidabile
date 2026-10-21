import { validateAnswers } from "@fb/core/answers";
import type { FormDefinition } from "@fb/core/definition";
import { Context, Effect, Layer, Option } from "effect";
import { type Actor, Unauthenticated } from "../authorization/actor.ts";
import type {
  EditedResponse,
  RespondentForm,
  RespondentResponse,
  SubmittedResponse,
} from "../envelopes.ts";
import {
  AlreadyResponded,
  FormClosed,
  FormNotPublished,
  NotFound,
  RevisionConflict,
  ValidationFailed,
  VersionSuperseded,
} from "../errors.ts";
import { Database, dieOnDatabaseError, isUniqueViolation } from "../persistence/database.ts";
import { shareForm } from "../persistence/forms.ts";
import {
  findAnswers,
  findByIdempotencyKey,
  findOwnResponse,
  insertResponse,
  latestResponseId,
  replaceAnswers,
} from "../persistence/responses.ts";
import { findVersionContent, storedDefinition } from "../persistence/versions.ts";

export interface SubmitResponse {
  readonly versionId: string;
  /** Validated against the version here, not at the edge. */
  readonly answers: unknown;
  /** Minted by the client for this submit attempt (ADR 0016). */
  readonly idempotencyKey: string;
}

export interface EditResponse {
  /** The revision the respondent last read. */
  readonly expectedRevision: string;
  /** Validated against the response's own version here, not at the edge. */
  readonly answers: unknown;
}

/** A form-bound actor (an anonymous grant, or a token with `refs`) reaches only its own form (ADR 0012). */
const reaches = (actor: Actor, formId: string) =>
  (actor._tag === "Anonymous" ? actor.formId : Option.getOrElse(actor.formId, () => formId)) ===
  formId;

export class Submission extends Context.Service<
  Submission,
  {
    /** The form's current published version, as its respondent sees it. */
    readonly load: (
      actor: Actor,
      formId: string,
    ) => Effect.Effect<RespondentForm, NotFound | FormNotPublished | FormClosed>;
    /** Any version of a form the respondent may load, current or not, for its answer schema. */
    readonly version: (
      actor: Actor,
      formId: string,
      versionId: string,
    ) => Effect.Effect<FormDefinition, NotFound | FormClosed>;
    /** Stores a response on the current version, with the actor's `refs`. */
    readonly submit: (
      actor: Actor,
      formId: string,
      submission: SubmitResponse,
    ) => Effect.Effect<
      SubmittedResponse,
      | NotFound
      | Unauthenticated
      | FormClosed
      | VersionSuperseded
      | AlreadyResponded
      | ValidationFailed
    >;
    /** The identified respondent's own response, whether or not the form is open. */
    readonly read: (
      actor: Actor,
      responseId: string,
    ) => Effect.Effect<RespondentResponse, NotFound | Unauthenticated>;
    /** Overwrites the answers on the response's own version; the stored references never change. */
    readonly edit: (
      actor: Actor,
      responseId: string,
      edit: EditResponse,
    ) => Effect.Effect<
      EditedResponse,
      NotFound | Unauthenticated | FormClosed | RevisionConflict | ValidationFailed
    >;
  }
>()("@fb/server/Submission") {
  static readonly layer = Layer.effect(
    Submission,
    Effect.gen(function* () {
      const db = yield* Database;
      return Submission.of({
        load: Effect.fn("Submission.load")(function* (actor, formId) {
          if (!reaches(actor, formId)) return yield* new NotFound();
          return yield* db
            .transaction(
              (tx) =>
                Effect.gen(function* () {
                  const form = yield* shareForm(tx, actor.tenant, formId);
                  if (form === undefined) return yield* new NotFound();
                  // A never-published form is always closed, so this comes first.
                  if (form.currentVersionId === null) return yield* new FormNotPublished();
                  if (form.availability === "closed") return yield* new FormClosed();
                  const version = yield* findVersionContent(tx, form, form.currentVersionId);
                  const myResponseId =
                    actor._tag === "Identified" && form.responseLimit === "one_per_respondent"
                      ? yield* latestResponseId(tx, form, actor.subject)
                      : undefined;
                  return {
                    formId: form.id,
                    responseLimit: form.responseLimit,
                    respondent: actor._tag === "Identified" ? "identified" : "anonymous",
                    version: version!,
                    myResponseId: myResponseId ?? null,
                  } satisfies RespondentForm;
                }),
              { isolationLevel: "read committed" },
            )
            .pipe(dieOnDatabaseError);
        }),
        version: Effect.fn("Submission.version")(function* (actor, formId, versionId) {
          if (!reaches(actor, formId)) return yield* new NotFound();
          return yield* db
            .transaction(
              (tx) =>
                Effect.gen(function* () {
                  const form = yield* shareForm(tx, actor.tenant, formId);
                  if (form === undefined) return yield* new NotFound();
                  if (form.availability === "closed") return yield* new FormClosed();
                  const version = yield* findVersionContent(tx, form, versionId);
                  if (version === undefined) return yield* new NotFound();
                  return storedDefinition(version.definition);
                }),
              { isolationLevel: "read committed" },
            )
            .pipe(dieOnDatabaseError);
        }),
        submit: Effect.fn("Submission.submit")(function* (actor, formId, submission) {
          if (!reaches(actor, formId)) return yield* new NotFound();
          const respondentId = actor._tag === "Identified" ? actor.subject : null;
          const attempt = db.transaction(
            (tx) =>
              Effect.gen(function* () {
                const form = yield* shareForm(tx, actor.tenant, formId);
                if (form === undefined) return yield* new NotFound();
                // A retry reports the response its key already made, whatever changed since (ADR 0016).
                const replayed = yield* findByIdempotencyKey(
                  tx,
                  form,
                  respondentId,
                  submission.idempotencyKey,
                );
                if (replayed !== undefined) {
                  return { responseId: replayed.id, revision: String(replayed.revision) };
                }
                // The limit counts responses per respondent, so a grant can't answer a limited form (ADR 0011).
                if (respondentId === null && form.responseLimit === "one_per_respondent") {
                  return yield* new Unauthenticated({ reason: "identityRequired" });
                }
                // Only a published form opens, so an open form has a current version.
                if (form.availability === "closed" || form.currentVersionId === null) {
                  return yield* new FormClosed();
                }
                if (submission.versionId !== form.currentVersionId) {
                  return yield* new VersionSuperseded({ currentVersionId: form.currentVersionId });
                }
                if (respondentId !== null && form.responseLimit === "one_per_respondent") {
                  const responseId = yield* latestResponseId(tx, form, respondentId);
                  if (responseId !== undefined) return yield* new AlreadyResponded({ responseId });
                }
                const version = yield* findVersionContent(tx, form, form.currentVersionId);
                const valid = validateAnswers(
                  storedDefinition(version!.definition),
                  submission.answers,
                );
                if (!valid.ok) return yield* new ValidationFailed({ issues: valid.issues });
                const inserted = yield* insertResponse(tx, form, {
                  versionId: form.currentVersionId,
                  respondentId,
                  idempotencyKey: submission.idempotencyKey,
                  answers: valid.value,
                  refs: actor.refs,
                });
                return { responseId: inserted.id, revision: String(inserted.revision) };
              }),
            { isolationLevel: "read committed" },
          );
          return yield* attempt.pipe(
            // A concurrent submission won the limit's index or the key: the rerun finds it.
            Effect.catchIf(
              (error) =>
                isUniqueViolation(error, "responses_one_per_respondent") ||
                isUniqueViolation(error, "responses_idempotency_key_unique"),
              () => attempt,
            ),
            dieOnDatabaseError,
          );
        }),
        read: Effect.fn("Submission.read")(function* (actor, responseId) {
          if (actor._tag === "Anonymous") {
            return yield* new Unauthenticated({ reason: "identityRequired" });
          }
          return yield* db
            .transaction(
              (tx) =>
                Effect.gen(function* () {
                  const response = yield* findOwnResponse(
                    tx,
                    actor.tenant,
                    actor.subject,
                    responseId,
                    "share",
                  );
                  if (response === undefined || !reaches(actor, response.formId)) {
                    return yield* new NotFound();
                  }
                  const form = (yield* shareForm(tx, actor.tenant, response.formId))!;
                  return {
                    response: {
                      id: response.id,
                      formId: response.formId,
                      versionId: response.versionId,
                      revision: String(response.revision),
                      answers: yield* findAnswers(tx, form, response.id),
                      submittedAt: response.submittedAt,
                      editedAt: response.editedAt,
                    },
                    version: (yield* findVersionContent(tx, form, response.versionId))!,
                    editable: form.availability === "open",
                  } satisfies RespondentResponse;
                }),
              { isolationLevel: "read committed" },
            )
            .pipe(dieOnDatabaseError);
        }),
        edit: Effect.fn("Submission.edit")(function* (actor, responseId, edit) {
          if (actor._tag === "Anonymous") {
            return yield* new Unauthenticated({ reason: "identityRequired" });
          }
          return yield* db
            .transaction(
              (tx) =>
                Effect.gen(function* () {
                  const response = yield* findOwnResponse(
                    tx,
                    actor.tenant,
                    actor.subject,
                    responseId,
                    "update",
                  );
                  if (response === undefined || !reaches(actor, response.formId)) {
                    return yield* new NotFound();
                  }
                  const form = (yield* shareForm(tx, actor.tenant, response.formId))!;
                  if (form.availability === "closed") return yield* new FormClosed();
                  if (String(response.revision) !== edit.expectedRevision) {
                    return yield* new RevisionConflict();
                  }
                  // A response never moves between versions (ADR 0002).
                  const version = yield* findVersionContent(tx, form, response.versionId);
                  const valid = validateAnswers(
                    storedDefinition(version!.definition),
                    edit.answers,
                  );
                  if (!valid.ok) return yield* new ValidationFailed({ issues: valid.issues });
                  const edited = yield* replaceAnswers(tx, form, response, valid.value);
                  return {
                    responseId: edited.id,
                    revision: String(edited.revision),
                    editedAt: edited.editedAt,
                  } satisfies EditedResponse;
                }),
              { isolationLevel: "read committed" },
            )
            .pipe(dieOnDatabaseError);
        }),
      });
    }),
  );
}
