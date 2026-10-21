import { validateAnswers } from "@fb/core/answers";
import { Context, Effect, Layer, Option } from "effect";
import { type Actor, Unauthenticated } from "../authorization/actor.ts";
import type { RespondentForm, SubmittedResponse } from "../envelopes.ts";
import {
  AlreadyResponded,
  FormClosed,
  FormNotPublished,
  NotFound,
  ValidationFailed,
  VersionSuperseded,
} from "../errors.ts";
import { Database, dieOnDatabaseError, isUniqueViolation } from "../persistence/database.ts";
import { shareForm } from "../persistence/forms.ts";
import { insertResponse, latestResponseId } from "../persistence/responses.ts";
import { findVersionContent, storedDefinition } from "../persistence/versions.ts";

export interface SubmitResponse {
  readonly versionId: string;
  /** Validated against the version here, not at the edge. */
  readonly answers: unknown;
  /** Minted by the client for this submit attempt (ADR 0016). */
  readonly idempotencyKey: string;
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
        submit: Effect.fn("Submission.submit")(function* (actor, formId, submission) {
          if (!reaches(actor, formId)) return yield* new NotFound();
          if (actor._tag === "Anonymous") {
            return yield* new Unauthenticated({ reason: "identityRequired" });
          }
          const attempt = db.transaction(
            (tx) =>
              Effect.gen(function* () {
                const form = yield* shareForm(tx, actor.tenant, formId);
                if (form === undefined) return yield* new NotFound();
                // Only a published form opens, so an open form has a current version.
                if (form.availability === "closed" || form.currentVersionId === null) {
                  return yield* new FormClosed();
                }
                if (submission.versionId !== form.currentVersionId) {
                  return yield* new VersionSuperseded({ currentVersionId: form.currentVersionId });
                }
                if (form.responseLimit === "one_per_respondent") {
                  const responseId = yield* latestResponseId(tx, form, actor.subject);
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
                  respondentId: actor.subject,
                  idempotencyKey: submission.idempotencyKey,
                  answers: valid.value,
                  refs: actor.refs,
                });
                return { responseId: inserted.id, revision: String(inserted.revision) };
              }),
            { isolationLevel: "read committed" },
          );
          return yield* attempt.pipe(
            // A concurrent first submission won the limit's index: the rerun finds it.
            Effect.catchIf(
              (error) => isUniqueViolation(error, "responses_one_per_respondent"),
              () => attempt,
            ),
            dieOnDatabaseError,
          );
        }),
      });
    }),
  );
}
