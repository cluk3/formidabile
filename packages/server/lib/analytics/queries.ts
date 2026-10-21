import { and, eq, inArray, sql } from "drizzle-orm";
import type { TenantId } from "../authorization/actor.ts";
import type { Database } from "../persistence/database.ts";
import {
  answers,
  forms,
  formVersionQuestions,
  formVersions,
  responses,
} from "../persistence/schema.ts";

type Db = Database["Service"];

const count = sql<number>`count(*)::int`;

/**
 * Each version with its response count. No rows when the tenant has no such form, and one row with a null
 * version when it was never published.
 */
export const responsesPerVersion = (db: Db, tenant: TenantId, formId: string) =>
  db
    .select({
      id: formVersions.id,
      number: formVersions.number,
      publishedAt: formVersions.publishedAt,
      definition: formVersions.definition,
      responses: sql<number>`count(${responses.id})::int`,
    })
    .from(forms)
    .leftJoin(formVersions, eq(formVersions.formId, forms.id))
    .leftJoin(responses, eq(responses.versionId, formVersions.id))
    .where(and(eq(forms.tenant, tenant), eq(forms.id, formId)))
    .groupBy(forms.id, formVersions.id);

/** The form's answer rows, with each question's type from its question key. */
const formAnswers = (db: Db, tenant: TenantId, formId: string) =>
  db
    .select({
      versionId: answers.versionId,
      questionId: answers.questionId,
      value: answers.value,
      type: formVersionQuestions.type,
    })
    .from(answers)
    .innerJoin(
      formVersionQuestions,
      and(
        eq(formVersionQuestions.versionId, answers.versionId),
        eq(formVersionQuestions.questionId, answers.questionId),
      ),
    )
    .innerJoin(forms, eq(forms.id, formVersionQuestions.formId))
    .where(and(eq(forms.tenant, tenant), eq(forms.id, formId)))
    .as("form_answers");

export const answeredPerQuestion = (db: Db, tenant: TenantId, formId: string) => {
  const rows = formAnswers(db, tenant, formId);
  return db
    .select({ versionId: rows.versionId, questionId: rows.questionId, count })
    .from(rows)
    .groupBy(rows.versionId, rows.questionId);
};

/** Single-choice values, and boolean values as `"true"` and `"false"`. */
export const valueCounts = (db: Db, tenant: TenantId, formId: string) => {
  const rows = formAnswers(db, tenant, formId);
  const value = sql<string>`${rows.value} #>> '{}'`;
  return db
    .select({ versionId: rows.versionId, questionId: rows.questionId, value, count })
    .from(rows)
    .where(inArray(rows.type, ["single_choice", "boolean"]))
    .groupBy(rows.versionId, rows.questionId, value);
};

/** Each option selected in a multiple-choice answer. */
export const optionCounts = (db: Db, tenant: TenantId, formId: string) => {
  const rows = formAnswers(db, tenant, formId);
  const selected = db
    .select({
      versionId: rows.versionId,
      questionId: rows.questionId,
      value: sql<string>`jsonb_array_elements_text(${rows.value})`.as("value"),
    })
    .from(rows)
    .where(eq(rows.type, "multiple_choice"))
    .as("selected");
  return db
    .select({
      versionId: selected.versionId,
      questionId: selected.questionId,
      value: selected.value,
      count,
    })
    .from(selected)
    .groupBy(selected.versionId, selected.questionId, selected.value);
};

const numberAggregates = (value: unknown) => {
  const numeric = sql`(${value})::float8`;
  return {
    count,
    min: sql<number | null>`min(${numeric})`,
    max: sql<number | null>`max(${numeric})`,
    mean: sql<number | null>`avg(${numeric})`,
    median: sql<number | null>`percentile_cont(0.5) WITHIN GROUP (ORDER BY ${numeric})`,
  };
};

export const numbersPerVersion = (db: Db, tenant: TenantId, formId: string) => {
  const rows = formAnswers(db, tenant, formId);
  return db
    .select({
      versionId: rows.versionId,
      questionId: rows.questionId,
      ...numberAggregates(rows.value),
    })
    .from(rows)
    .where(eq(rows.type, "number"))
    .groupBy(rows.versionId, rows.questionId);
};

/** Across every version, since medians can't be combined from per-version medians. */
export const numbersCombined = (db: Db, tenant: TenantId, formId: string) => {
  const rows = formAnswers(db, tenant, formId);
  return db
    .select({ questionId: rows.questionId, ...numberAggregates(rows.value) })
    .from(rows)
    .where(eq(rows.type, "number"))
    .groupBy(rows.questionId);
};
