import type { Answers } from "@fb/core/answers";
import { and, desc, eq } from "drizzle-orm";
import { Effect } from "effect";
import type { ExternalRef } from "../authorization/actor.ts";
import type { Database } from "./database.ts";
import type { SharedForm } from "./forms.ts";
import { currentInstant, newId } from "./ids.ts";
import { answers, responseExternalRefs, responses } from "./schema.ts";

type Db = Database["Service"];

/** Whatever the limit was when each response came in. */
export const latestResponseId = (db: Db, form: SharedForm, respondentId: string) =>
  db
    .select({ id: responses.id })
    .from(responses)
    .where(and(eq(responses.formId, form.id), eq(responses.respondentId, respondentId)))
    .orderBy(desc(responses.submittedAt), desc(responses.id))
    .limit(1)
    .pipe(Effect.map(([row]) => row?.id));

export interface NewResponse {
  readonly versionId: string;
  /** Null when anonymous. */
  readonly respondentId: string | null;
  readonly idempotencyKey: string;
  readonly answers: Answers;
  readonly refs: ReadonlyArray<ExternalRef>;
}

/** Inserts the response at revision 1 with its answer rows and references, under the form's limit. */
export const insertResponse = (db: Db, form: SharedForm, response: NewResponse) =>
  Effect.gen(function* () {
    const id = yield* newId;
    const [inserted] = yield* db
      .insert(responses)
      .values({
        id,
        formId: form.id,
        versionId: response.versionId,
        respondentId: response.respondentId,
        limited: form.responseLimit === "one_per_respondent",
        revision: 1,
        idempotencyKey: response.idempotencyKey,
        submittedAt: yield* currentInstant,
      })
      .returning({ id: responses.id, revision: responses.revision });
    const answered = Object.entries(response.answers);
    if (answered.length > 0) {
      yield* db.insert(answers).values(
        answered.map(([questionId, value]) => ({
          responseId: id,
          questionId,
          versionId: response.versionId,
          value,
        })),
      );
    }
    if (response.refs.length > 0) {
      yield* db
        .insert(responseExternalRefs)
        .values(response.refs.map((ref) => ({ responseId: id, ...ref })));
    }
    return inserted!;
  });
