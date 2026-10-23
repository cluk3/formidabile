import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { TenantId } from "../authorization/actor.ts";
import type { Database } from "../persistence/database.ts";
import {
  answers,
  forms,
  formVersionQuestions,
  formVersions,
  responsePath,
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

/** Stored path rows per question. Analytics reads this table and does not re-run the path function. */
export const shownPerQuestion = (db: Db, tenant: TenantId, formId: string) =>
  db
    .select({
      versionId: responsePath.versionId,
      questionId: responsePath.questionId,
      count,
    })
    .from(responsePath)
    .innerJoin(
      formVersionQuestions,
      and(
        eq(formVersionQuestions.versionId, responsePath.versionId),
        eq(formVersionQuestions.questionId, responsePath.questionId),
      ),
    )
    .innerJoin(forms, eq(forms.id, formVersionQuestions.formId))
    .where(and(eq(forms.tenant, tenant), eq(forms.id, formId)))
    .groupBy(responsePath.versionId, responsePath.questionId);

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

/**
 * Sum of 1-based places, and first-place counts, for each option in a ranking answer.
 * Only ranking rows are expanded: `jsonb_array_elements_text` errors on a scalar.
 */
export const rankingPositions = (db: Db, tenant: TenantId, formId: string) => {
  const rows = formAnswers(db, tenant, formId);
  const placed = db
    .select({
      versionId: rows.versionId,
      questionId: rows.questionId,
      value: sql<string>`item.value`.as("value"),
      ordinality: sql<number>`item.ordinality::int`.as("ordinality"),
    })
    .from(rows)
    .crossJoinLateral(
      sql`jsonb_array_elements_text(${rows.value}) with ordinality as item(value, ordinality)`,
    )
    .where(eq(rows.type, "ranking"))
    .as("placed");
  return db
    .select({
      versionId: placed.versionId,
      questionId: placed.questionId,
      value: placed.value,
      positionSum: sql<number>`sum(${placed.ordinality})::float8`,
      firstPlace: sql<number>`count(*) filter (where ${placed.ordinality} = 1)::int`,
    })
    .from(placed)
    .groupBy(placed.versionId, placed.questionId, placed.value);
};

/**
 * Each column selected in a single-choice matrix, per answered row. A row key is one answered row;
 * its value is the column.
 */
export const matrixSingleCounts = (db: Db, tenant: TenantId, formId: string) => {
  const rows = formAnswers(db, tenant, formId);
  const cells = db
    .select({
      versionId: rows.versionId,
      questionId: rows.questionId,
      row: sql<string>`entry.key`.as("row"),
      column: sql<string>`entry.value`.as("column"),
    })
    .from(rows)
    .innerJoin(sql`jsonb_each_text(${rows.value}) as entry`, sql`true`)
    .where(eq(rows.type, "single_choice_matrix"))
    .as("matrix_single_cells");
  return db
    .select({
      versionId: cells.versionId,
      questionId: cells.questionId,
      row: cells.row,
      column: cells.column,
      count,
    })
    .from(cells)
    .groupBy(cells.versionId, cells.questionId, cells.row, cells.column);
};

/** Each column selected in a multiple-choice matrix row. One answered row can select several. */
export const matrixMultipleCounts = (db: Db, tenant: TenantId, formId: string) => {
  const rows = formAnswers(db, tenant, formId);
  const cells = db
    .select({
      versionId: rows.versionId,
      questionId: rows.questionId,
      row: sql<string>`entry.key`.as("row"),
      column: sql<string>`jsonb_array_elements_text(entry.value)`.as("column"),
    })
    .from(rows)
    .innerJoin(sql`jsonb_each(${rows.value}) as entry`, sql`true`)
    .where(eq(rows.type, "multiple_choice_matrix"))
    .as("matrix_multiple_cells");
  return db
    .select({
      versionId: cells.versionId,
      questionId: cells.questionId,
      row: cells.row,
      column: cells.column,
      count,
    })
    .from(cells)
    .groupBy(cells.versionId, cells.questionId, cells.row, cells.column);
};

/** How many responses answered each matrix row. The base of a cell counts only versions that had it. */
export const matrixAnsweredRows = (db: Db, tenant: TenantId, formId: string) => {
  const rows = formAnswers(db, tenant, formId);
  const answered = db
    .select({
      versionId: rows.versionId,
      questionId: rows.questionId,
      row: sql<string>`jsonb_object_keys(${rows.value})`.as("row"),
    })
    .from(rows)
    .where(inArray(rows.type, ["single_choice_matrix", "multiple_choice_matrix"]))
    .as("matrix_answered_rows");
  return db
    .select({
      versionId: answered.versionId,
      questionId: answered.questionId,
      row: answered.row,
      count,
    })
    .from(answered)
    .groupBy(answered.versionId, answered.questionId, answered.row);
};

/** Promoter, passive and detractor counts for every number question. The merge drops non-NPS versions. */
export const npsCounts = (db: Db, tenant: TenantId, formId: string) => {
  const rows = formAnswers(db, tenant, formId);
  const numeric = sql`(${rows.value})::float8`;
  const bucket = (when: SQL) =>
    sql<number>`coalesce(sum(case when ${when} then 1 else 0 end), 0)::int`;
  return db
    .select({
      versionId: rows.versionId,
      questionId: rows.questionId,
      promoters: bucket(sql`${numeric} >= 9 and ${numeric} <= 10`),
      passives: bucket(sql`${numeric} >= 7 and ${numeric} < 9`),
      detractors: bucket(sql`${numeric} >= 0 and ${numeric} < 7`),
    })
    .from(rows)
    .where(eq(rows.type, "number"))
    .groupBy(rows.versionId, rows.questionId);
};
