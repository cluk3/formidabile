import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  check,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Schema } from "effect";

export const formManagement = pgSchema("form_management");

// Revisions never repeat across a form's successive drafts (ADR 0007).
export const draftRevisions = formManagement.sequence("draft_revisions");

const instant = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const forms = formManagement.table(
  "forms",
  {
    id: uuid("id").primaryKey(),
    tenant: text("tenant").notNull(),
    availability: text("availability", { enum: ["open", "closed"] }).notNull(),
    responseLimit: text("response_limit", {
      enum: ["unlimited", "one_per_respondent"],
    }).notNull(),
    currentVersionId: uuid("current_version_id"),
    createdAt: instant("created_at").notNull(),
    updatedAt: instant("updated_at").notNull(),
  },
  (table) => [
    foreignKey({
      name: "forms_current_version_fkey",
      columns: [table.currentVersionId, table.id],
      foreignColumns: [formVersions.id, formVersions.formId],
    }),
    check("forms_availability_check", sql`${table.availability} IN ('open', 'closed')`),
    check(
      "forms_response_limit_check",
      sql`${table.responseLimit} IN ('unlimited', 'one_per_respondent')`,
    ),
    check(
      "forms_open_needs_version_check",
      sql`${table.availability} = 'closed' OR ${table.currentVersionId} IS NOT NULL`,
    ),
  ],
);

export const drafts = formManagement.table(
  "drafts",
  {
    formId: uuid("form_id")
      .primaryKey()
      .references(() => forms.id, { onDelete: "cascade" }),
    revision: bigint("revision", { mode: "bigint" })
      .notNull()
      .default(sql`nextval('form_management.draft_revisions')`),
    basedOnVersionId: uuid("based_on_version_id"),
    definition: jsonb("definition").$type<Schema.Json>().notNull(),
    updatedAt: instant("updated_at").notNull(),
  },
  (table) => [
    foreignKey({
      name: "drafts_based_on_version_fkey",
      columns: [table.basedOnVersionId, table.formId],
      foreignColumns: [formVersions.id, formVersions.formId],
    }),
  ],
);

export const formVersions = formManagement.table(
  "form_versions",
  {
    id: uuid("id").primaryKey(),
    formId: uuid("form_id")
      .notNull()
      .references((): AnyPgColumn => forms.id),
    number: integer("number").notNull(),
    definition: jsonb("definition").$type<Schema.Json>().notNull(),
    publishedAt: instant("published_at").notNull(),
    publishedBy: text("published_by").notNull(),
    derivedFromVersionId: uuid("derived_from_version_id"),
  },
  (table) => [
    unique().on(table.formId, table.number),
    // The target of every same-form composite foreign key.
    unique().on(table.id, table.formId),
    foreignKey({
      name: "form_versions_derived_from_version_fkey",
      columns: [table.derivedFromVersionId, table.formId],
      foreignColumns: [table.id, table.formId],
    }),
    check("form_versions_number_check", sql`${table.number} >= 1`),
  ],
);

export const questionIdentities = formManagement.table(
  "question_identities",
  {
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id),
    questionId: uuid("question_id").notNull(),
    type: text("type").notNull(),
  },
  (table) => [
    // One question type per identity for life (ADR 0005).
    primaryKey({ columns: [table.formId, table.questionId] }),
    // Only the target of `form_version_questions`' foreign key: Postgres needs an exact unique match.
    unique().on(table.formId, table.questionId, table.type),
  ],
);

// Keys only: labels, config and options stay in the version's definition.
export const formVersionQuestions = formManagement.table(
  "form_version_questions",
  {
    versionId: uuid("version_id").notNull(),
    questionId: uuid("question_id").notNull(),
    formId: uuid("form_id").notNull(),
    type: text("type").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.versionId, table.questionId] }),
    foreignKey({
      name: "form_version_questions_identity_fkey",
      columns: [table.formId, table.questionId, table.type],
      foreignColumns: [
        questionIdentities.formId,
        questionIdentities.questionId,
        questionIdentities.type,
      ],
    }),
    foreignKey({
      name: "form_version_questions_version_fkey",
      columns: [table.versionId, table.formId],
      foreignColumns: [formVersions.id, formVersions.formId],
    }),
  ],
);

export const responses = formManagement.table(
  "responses",
  {
    id: uuid("id").primaryKey(),
    formId: uuid("form_id").notNull(),
    versionId: uuid("version_id").notNull(),
    // The actor's subject, null when anonymous.
    respondentId: text("respondent_id"),
    // Whether the form was one per respondent at submission (ADR 0007).
    limited: boolean("limited").notNull(),
    revision: integer("revision").notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    submittedAt: instant("submitted_at").notNull(),
    editedAt: instant("edited_at"),
  },
  (table) => [
    foreignKey({
      name: "responses_version_fkey",
      columns: [table.versionId, table.formId],
      foreignColumns: [formVersions.id, formVersions.formId],
    }).onDelete("restrict"),
    // The target of `answers`' foreign key, so an answer can't leave its response's version.
    unique().on(table.id, table.versionId),
    // Anonymous respondents share a null respondent, so among them a key is unique per form (ADR 0016).
    unique("responses_idempotency_key_unique")
      .on(table.formId, table.respondentId, table.idempotencyKey)
      .nullsNotDistinct(),
    uniqueIndex("responses_one_per_respondent")
      .on(table.formId, table.respondentId)
      .where(sql`${table.limited}`),
    index("responses_form_id_version_id_index").on(table.formId, table.versionId),
    index("responses_respondent_id_index").on(table.respondentId),
    check("responses_revision_check", sql`${table.revision} >= 1`),
    // Anonymous respondents can't answer a limited form (ADR 0006), and the partial index can't see them.
    check(
      "responses_limited_needs_respondent_check",
      sql`NOT ${table.limited} OR ${table.respondentId} IS NOT NULL`,
    ),
  ],
);

// One row per answered question; the value is the untagged answer (ADR 0005).
export const answers = formManagement.table(
  "answers",
  {
    responseId: uuid("response_id").notNull(),
    questionId: uuid("question_id").notNull(),
    versionId: uuid("version_id").notNull(),
    value: jsonb("value").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.responseId, table.questionId] }),
    foreignKey({
      name: "answers_response_fkey",
      columns: [table.responseId, table.versionId],
      foreignColumns: [responses.id, responses.versionId],
    }).onDelete("cascade"),
    foreignKey({
      name: "answers_question_fkey",
      columns: [table.versionId, table.questionId],
      foreignColumns: [formVersionQuestions.versionId, formVersionQuestions.questionId],
    }),
    // Distributions group by question within a version (ADR 0009).
    index("answers_version_id_question_id_index").on(table.versionId, table.questionId),
  ],
);

// The shape limits the edge also checks, counted in code points (ADR 0012, ADR 0015).
const externalRefChecks = (
  table: string,
  columns: { namespace: AnyPgColumn; refId: AnyPgColumn },
) => [
  check(
    `${table}_namespace_check`,
    sql`char_length(${columns.namespace}) <= 64 AND ${columns.namespace} ~ '^[a-z][a-z0-9_.-]*$'`,
  ),
  check(`${table}_ref_id_check`, sql`char_length(${columns.refId}) BETWEEN 1 AND 255`),
];

// A mutable association set.
export const formExternalRefs = formManagement.table(
  "form_external_refs",
  {
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    namespace: text("namespace").notNull(),
    refId: text("ref_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.formId, table.namespace, table.refId] }),
    index("form_external_refs_namespace_ref_id_index").on(table.namespace, table.refId),
    ...externalRefChecks("form_external_refs", table),
  ],
);

// The `refs` of the token that submitted, written once with the response (ADR 0012).
export const responseExternalRefs = formManagement.table(
  "response_external_refs",
  {
    responseId: uuid("response_id")
      .notNull()
      .references(() => responses.id, { onDelete: "cascade" }),
    namespace: text("namespace").notNull(),
    refId: text("ref_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.responseId, table.namespace, table.refId] }),
    index("response_external_refs_namespace_ref_id_index").on(table.namespace, table.refId),
    ...externalRefChecks("response_external_refs", table),
  ],
);
