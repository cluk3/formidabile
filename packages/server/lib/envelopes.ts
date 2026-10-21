import { Schema } from "effect";

/**
 * A definition as JSON: `@fb/core` parses it, and `@fb/http-api` documents it with core's JSON Schema under
 * this identifier (ADR 0004).
 */
export const FormDefinitionJson = Schema.Json.annotate({ identifier: "FormDefinition" });

export const Availability = Schema.Literals(["open", "closed"]);
export const ResponseLimit = Schema.Literals(["unlimited", "one_per_respondent"]);

/** Draft revisions come from a `bigint` sequence that can pass 2^53, so above persistence they're opaque. */
const Revision = Schema.String;

export const Form = Schema.Struct({
  id: Schema.String,
  availability: Availability,
  responseLimit: ResponseLimit,
  currentVersionId: Schema.NullOr(Schema.String),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
}).annotate({ identifier: "Form" });
export type Form = typeof Form.Type;

export const VersionSummary = Schema.Struct({
  id: Schema.String,
  number: Schema.Int,
  publishedAt: Schema.Date,
  publishedBy: Schema.String,
  derivedFromVersionId: Schema.NullOr(Schema.String),
  isCurrent: Schema.Boolean,
}).annotate({ identifier: "VersionSummary" });
export type VersionSummary = typeof VersionSummary.Type;

export const FormVersion = Schema.Struct({
  ...VersionSummary.fields,
  definition: FormDefinitionJson,
}).annotate({ identifier: "FormVersion" });
export type FormVersion = typeof FormVersion.Type;

export const Draft = Schema.Struct({
  formId: Schema.String,
  revision: Revision,
  basedOnVersionId: Schema.NullOr(Schema.String),
  definition: FormDefinitionJson,
  updatedAt: Schema.Date,
}).annotate({ identifier: "Draft" });
export type Draft = typeof Draft.Type;

export const DraftSummary = Schema.Struct({
  revision: Revision,
  basedOnVersionId: Schema.NullOr(Schema.String),
  updatedAt: Schema.Date,
}).annotate({ identifier: "DraftSummary" });
export type DraftSummary = typeof DraftSummary.Type;

export const FormSummary = Schema.Struct({
  id: Schema.String,
  /** The draft's title, or else the current version's. */
  title: Schema.String,
  availability: Availability,
  responseLimit: ResponseLimit,
  currentVersion: Schema.NullOr(VersionSummary),
  hasDraft: Schema.Boolean,
  updatedAt: Schema.Date,
}).annotate({ identifier: "FormSummary" });
export type FormSummary = typeof FormSummary.Type;

export const FormDetail = Schema.Struct({
  id: Schema.String,
  availability: Availability,
  responseLimit: ResponseLimit,
  currentVersion: Schema.NullOr(VersionSummary),
  draft: Schema.NullOr(DraftSummary),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
}).annotate({ identifier: "FormDetail" });
export type FormDetail = typeof FormDetail.Type;
