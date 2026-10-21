import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  check,
  foreignKey,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
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
