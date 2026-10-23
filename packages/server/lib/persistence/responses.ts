import type { Answers } from "@fb/core/answers";
import { and, desc, eq, exists, inArray, isNull, lt, type SQL, sql } from "drizzle-orm";
import { Effect, type Schema } from "effect";
import type { ExternalRef, TenantId } from "../authorization/actor.ts";
import type { Database } from "./database.ts";
import type { SharedForm } from "./forms.ts";
import { currentInstant, newId } from "./ids.ts";
import {
  answers,
  forms,
  formVersionQuestions,
  formVersions,
  responseExternalRefs,
  responsePath,
  responses,
} from "./schema.ts";

type Db = Database["Service"];

/** Every filter is optional: none lists the whole tenant. */
export interface ResponseFilter {
  readonly formId?: string | undefined;
  readonly versionId?: string | undefined;
  readonly ref?: ExternalRef | undefined;
  readonly respondentId?: string | undefined;
}

const summaryColumns = {
  id: responses.id,
  formId: responses.formId,
  versionId: responses.versionId,
  versionNumber: formVersions.number,
  respondentId: responses.respondentId,
  submittedAt: responses.submittedAt,
  editedAt: responses.editedAt,
};

/** A response in the tenant, with the definition of the version it was submitted under. */
export const findResponse = (db: Db, tenant: TenantId, responseId: string) =>
  db
    .select({ response: summaryColumns, definition: formVersions.definition })
    .from(responses)
    .innerJoin(forms, eq(forms.id, responses.formId))
    .innerJoin(formVersions, eq(formVersions.id, responses.versionId))
    .where(and(eq(forms.tenant, tenant), eq(responses.id, responseId)))
    .pipe(Effect.map(([row]) => row));

/**
 * Up to `limit` responses older than `cursor`, newest first by id: UUIDv7 ids order by time, and edits never
 * change them, so pages stay stable.
 */
export const listResponses = (
  db: Db,
  tenant: TenantId,
  filter: ResponseFilter,
  page: { readonly cursor?: string | undefined; readonly limit: number },
) =>
  db
    .select(summaryColumns)
    .from(responses)
    .innerJoin(forms, eq(forms.id, responses.formId))
    .innerJoin(formVersions, eq(formVersions.id, responses.versionId))
    .where(
      and(
        eq(forms.tenant, tenant),
        filter.formId === undefined ? undefined : eq(responses.formId, filter.formId),
        filter.versionId === undefined ? undefined : eq(responses.versionId, filter.versionId),
        filter.respondentId === undefined
          ? undefined
          : eq(responses.respondentId, filter.respondentId),
        filter.ref &&
          exists(
            db
              .select({ responseId: responseExternalRefs.responseId })
              .from(responseExternalRefs)
              .where(
                and(
                  eq(responseExternalRefs.responseId, responses.id),
                  eq(responseExternalRefs.namespace, filter.ref.namespace),
                  eq(responseExternalRefs.refId, filter.ref.refId),
                ),
              ),
          ),
        page.cursor === undefined ? undefined : lt(responses.id, page.cursor),
      ),
    )
    .orderBy(desc(responses.id))
    .limit(page.limit);

/** Each response's references, sorted by namespace, then `refId`, byte-wise like a form's. */
export const findResponseRefs = (db: Db, responseIds: ReadonlyArray<string>) =>
  db
    .select({
      responseId: responseExternalRefs.responseId,
      namespace: responseExternalRefs.namespace,
      refId: responseExternalRefs.refId,
    })
    .from(responseExternalRefs)
    .where(inArray(responseExternalRefs.responseId, [...responseIds]))
    .orderBy(
      sql`${responseExternalRefs.namespace} COLLATE "C"`,
      sql`${responseExternalRefs.refId} COLLATE "C"`,
    )
    .pipe(
      Effect.map((rows) => {
        const byResponse = new Map<string, Array<ExternalRef>>();
        for (const { responseId, ...ref } of rows) {
          const refs = byResponse.get(responseId);
          if (refs === undefined) byResponse.set(responseId, [ref]);
          else refs.push(ref);
        }
        return byResponse;
      }),
    );

const inTenant = (db: Db, tenant: TenantId) =>
  inArray(
    responses.formId,
    db.select({ id: forms.id }).from(forms).where(eq(forms.tenant, tenant)),
  );

/** Answers, the path and references go by cascade. Gives how many responses were deleted. */
const deleteResponsesWhere = (db: Db, tenant: TenantId, condition: SQL) =>
  db
    .delete(responses)
    .where(and(inTenant(db, tenant), condition))
    .returning({ id: responses.id })
    .pipe(Effect.map((rows) => rows.length));

export const deleteResponse = (db: Db, tenant: TenantId, responseId: string) =>
  deleteResponsesWhere(db, tenant, eq(responses.id, responseId));

/** Every response the respondent gave to any form in the tenant. */
export const deleteRespondentResponses = (db: Db, tenant: TenantId, respondentId: string) =>
  deleteResponsesWhere(db, tenant, eq(responses.respondentId, respondentId));

/** Whatever the limit was when each response came in. */
export const latestResponseId = (db: Db, form: SharedForm, respondentId: string) =>
  db
    .select({ id: responses.id })
    .from(responses)
    .where(and(eq(responses.formId, form.id), eq(responses.respondentId, respondentId)))
    .orderBy(desc(responses.submittedAt), desc(responses.id))
    .limit(1)
    .pipe(Effect.map(([row]) => row?.id));

/** The response an earlier attempt with this key stored, as `responses_idempotency_key_unique` scopes it. */
export const findByIdempotencyKey = (
  db: Db,
  form: SharedForm,
  respondentId: string | null,
  idempotencyKey: string,
) =>
  db
    .select({ id: responses.id, revision: responses.revision })
    .from(responses)
    .where(
      and(
        eq(responses.formId, form.id),
        respondentId === null
          ? isNull(responses.respondentId)
          : eq(responses.respondentId, respondentId),
        eq(responses.idempotencyKey, idempotencyKey),
      ),
    )
    .pipe(Effect.map(([row]) => row));

/**
 * The respondent's own response in the tenant, locked until the transaction ends: `share` keeps a read's
 * revision and answers together, and `update` makes concurrent edits of one revision take turns.
 */
export const findOwnResponse = (
  db: Db,
  tenant: TenantId,
  respondentId: string,
  responseId: string,
  lock: "share" | "update",
) =>
  db
    .select({ response: responses })
    .from(responses)
    .innerJoin(forms, eq(forms.id, responses.formId))
    .where(
      and(
        eq(forms.tenant, tenant),
        eq(responses.id, responseId),
        eq(responses.respondentId, respondentId),
      ),
    )
    .for(lock, { of: responses })
    .pipe(Effect.map(([row]) => row?.response));

const byQuestion = (
  rows: ReadonlyArray<{ readonly questionId: string; readonly value: Schema.Json }>,
): Record<string, Schema.Json> =>
  Object.fromEntries(rows.map((row) => [row.questionId, row.value]));

export const findAnswers = (db: Db, form: SharedForm, responseId: string) =>
  db
    .select({ questionId: answers.questionId, value: answers.value })
    .from(answers)
    .innerJoin(responses, eq(responses.id, answers.responseId))
    .where(and(eq(responses.formId, form.id), eq(answers.responseId, responseId)))
    .pipe(Effect.map(byQuestion));

/** The answers of a response the caller already found in its tenant. */
export const findResponseAnswers = (db: Db, responseId: string) =>
  db
    .select({ questionId: answers.questionId, value: answers.value })
    .from(answers)
    .where(eq(answers.responseId, responseId))
    .pipe(Effect.map(byQuestion));

/** Question ids the response was shown, in its version's question order. */
export const findResponsePath = (db: Db, responseId: string) =>
  db
    .select({ questionId: responsePath.questionId })
    .from(responsePath)
    .innerJoin(
      formVersionQuestions,
      and(
        eq(formVersionQuestions.versionId, responsePath.versionId),
        eq(formVersionQuestions.questionId, responsePath.questionId),
      ),
    )
    .where(eq(responsePath.responseId, responseId))
    .orderBy(formVersionQuestions.position, responsePath.questionId)
    .pipe(Effect.map((rows) => rows.map((row) => row.questionId)));

const insertAnswers = (db: Db, responseId: string, versionId: string, given: Answers) => {
  const answered = Object.entries(given);
  return answered.length === 0
    ? Effect.void
    : db
        .insert(answers)
        .values(
          answered.map(([questionId, value]) => ({ responseId, questionId, versionId, value })),
        );
};

const insertPath = (db: Db, responseId: string, versionId: string, path: readonly string[]) =>
  path.length === 0
    ? Effect.void
    : db
        .insert(responsePath)
        .values(path.map((questionId) => ({ responseId, questionId, versionId })));

export interface NewResponse {
  readonly versionId: string;
  /** Null when anonymous. */
  readonly respondentId: string | null;
  readonly idempotencyKey: string;
  readonly answers: Answers;
  /** Question ids the respondent was shown. */
  readonly path: readonly string[];
  readonly refs: ReadonlyArray<ExternalRef>;
}

/** Inserts the response at revision 1 with its answers, path and references, under the form's limit. */
export const insertResponse = Effect.fnUntraced(function* (
  db: Db,
  form: SharedForm,
  response: NewResponse,
) {
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
  yield* insertAnswers(db, id, response.versionId, response.answers);
  yield* insertPath(db, id, response.versionId, response.path);
  if (response.refs.length > 0) {
    yield* db
      .insert(responseExternalRefs)
      .values(response.refs.map((ref) => ({ responseId: id, ...ref })));
  }
  return inserted!;
});

/** Overwrites the answers and the path on the response's own version and moves its revision; references never change. */
export const replaceAnswers = Effect.fnUntraced(function* (
  db: Db,
  form: SharedForm,
  response: { readonly id: string; readonly versionId: string },
  given: Answers,
  path: readonly string[],
) {
  const [edited] = yield* db
    .update(responses)
    .set({ revision: sql`${responses.revision} + 1`, editedAt: yield* currentInstant })
    .where(and(eq(responses.formId, form.id), eq(responses.id, response.id)))
    .returning({ id: responses.id, revision: responses.revision, editedAt: responses.editedAt });
  yield* db.delete(answers).where(eq(answers.responseId, response.id));
  yield* insertAnswers(db, response.id, response.versionId, given);
  yield* db.delete(responsePath).where(eq(responsePath.responseId, response.id));
  yield* insertPath(db, response.id, response.versionId, path);
  return { id: edited!.id, revision: edited!.revision, editedAt: edited!.editedAt! };
});
