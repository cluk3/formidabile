import type { QuestionTypeName } from "@fb/core/definition";
import { Schema } from "effect";
import { ExternalRef } from "./authorization/actor.ts";

/**
 * A definition as JSON: `@fb/core` parses it, and `@fb/http-api` documents it with core's JSON Schema under
 * this identifier (ADR 0004).
 */
export const FormDefinitionJson = Schema.Json.annotate({ identifier: "FormDefinition" });

/**
 * Answers as JSON: `@fb/core` validates them against the version, and `@fb/http-api` documents them with
 * core's `AnyAnswers` under this identifier.
 */
export const AnswersJson = Schema.Json.annotate({ identifier: "AnyAnswers" });

export const Availability = Schema.Literals(["open", "closed"]);
export const ResponseLimit = Schema.Literals(["unlimited", "one_per_respondent"]);

/** Revisions are opaque above persistence: a draft's comes from a `bigint` sequence that can pass 2^53. */
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

/** Null or missing leaves a setting unchanged; the last write wins. */
export const FormSettings = Schema.Struct({
  availability: Schema.optionalKey(Schema.NullOr(Availability)),
  responseLimit: Schema.optionalKey(Schema.NullOr(ResponseLimit)),
}).annotate({ identifier: "FormSettings" });
export type FormSettings = typeof FormSettings.Type;

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

/** A version as a respondent answers it, and as both response reads embed it. */
const RespondentVersion = Schema.Struct({
  id: Schema.String,
  number: Schema.Int,
  definition: FormDefinitionJson,
});

/** What a respondent loads: the form's current version, and enough to decide on a sign-in prompt. */
export const RespondentForm = Schema.Struct({
  formId: Schema.String,
  responseLimit: ResponseLimit,
  respondent: Schema.Literals(["identified", "anonymous"]),
  version: RespondentVersion,
  /** Set only for an identified respondent who already answered a one-per-respondent form. */
  myResponseId: Schema.NullOr(Schema.String),
}).annotate({ identifier: "RespondentForm" });
export type RespondentForm = typeof RespondentForm.Type;

export const SubmittedResponse = Schema.Struct({
  responseId: Schema.String,
  revision: Revision,
}).annotate({ identifier: "SubmittedResponse" });
export type SubmittedResponse = typeof SubmittedResponse.Type;

/** A respondent's own response, on the version it was submitted against, with raw answers. */
export const RespondentResponse = Schema.Struct({
  response: Schema.Struct({
    id: Schema.String,
    formId: Schema.String,
    versionId: Schema.String,
    revision: Revision,
    answers: AnswersJson,
    submittedAt: Schema.Date,
    editedAt: Schema.NullOr(Schema.Date),
  }),
  version: RespondentVersion,
  /** Whether the form is open, so an edit can succeed. */
  editable: Schema.Boolean,
}).annotate({ identifier: "RespondentResponse" });
export type RespondentResponse = typeof RespondentResponse.Type;

export const EditedResponse = Schema.Struct({
  responseId: Schema.String,
  revision: Revision,
  editedAt: Schema.Date,
}).annotate({ identifier: "EditedResponse" });
export type EditedResponse = typeof EditedResponse.Type;

/** A response as an admin lists it, with no answers. */
export const ResponseSummary = Schema.Struct({
  id: Schema.String,
  formId: Schema.String,
  versionId: Schema.String,
  versionNumber: Schema.Int,
  /** Null when anonymous. */
  respondentId: Schema.NullOr(Schema.String),
  submittedAt: Schema.Date,
  editedAt: Schema.NullOr(Schema.Date),
  /** The references its token asserted, sorted by namespace, then `refId`. */
  externalRefs: Schema.Array(ExternalRef),
}).annotate({ identifier: "ResponseSummary" });
export type ResponseSummary = typeof ResponseSummary.Type;

/** Newest first; `nextCursor` is null on the last page. */
export const ResponsePage = Schema.Struct({
  responses: Schema.Array(ResponseSummary),
  nextCursor: Schema.NullOr(Schema.String),
}).annotate({ identifier: "ResponsePage" });
export type ResponsePage = typeof ResponsePage.Type;

/** A response as an admin reads it: raw answers and the path it was shown, with its version. */
export const ResponseDetail = Schema.Struct({
  response: Schema.Struct({ ...ResponseSummary.fields, answers: AnswersJson }),
  version: RespondentVersion,
  /** Question ids the response was shown, in the version's question order (ADR-017). */
  path: Schema.Array(Schema.String),
}).annotate({ identifier: "ResponseDetail" });
export type ResponseDetail = typeof ResponseDetail.Type;

/** How many responses an erasure removed; 0 when the respondent had none in the tenant. */
export const DeletedResponses = Schema.Struct({ deleted: Schema.Int }).annotate({
  identifier: "DeletedResponses",
});
export type DeletedResponses = typeof DeletedResponses.Type;

const Count = Schema.Int;
/** Version numbers, ascending. */
const VersionNumbers = Schema.Array(Schema.Int);
/** The labels other versions gave, beside the label of the highest-numbered version (ADR 0009). */
const OtherLabels = Schema.Array(Schema.Struct({ label: Schema.String, versions: VersionNumbers }));

const QuestionTypeName = Schema.Literals([
  "text",
  "email",
  "number",
  "date",
  "single_choice",
  "multiple_choice",
  "boolean",
  "ranking",
] satisfies ReadonlyArray<QuestionTypeName>);

/** Each option's share is `count / base`; `base` counts only the versions that offered it. */
const ChoiceSummary = Schema.Struct({
  type: Schema.Literals(["single_choice", "multiple_choice"]),
  options: Schema.Array(
    Schema.Struct({
      value: Schema.String,
      label: Schema.String,
      otherLabels: OtherLabels,
      count: Count,
      base: Count,
      offeredIn: VersionNumbers,
    }),
  ),
});

/** Tagged by the question's type. Text, email and date questions report only answered and skipped counts. */
export const AnalyticsSummary = Schema.Union([
  ChoiceSummary,
  Schema.Struct({ type: Schema.Literal("boolean"), trueCount: Count, falseCount: Count }),
  // All but `count` are null when nothing was answered. `nps` is set only for the NPS display.
  Schema.Struct({
    type: Schema.Literal("number"),
    count: Count,
    min: Schema.NullOr(Schema.Finite),
    max: Schema.NullOr(Schema.Finite),
    mean: Schema.NullOr(Schema.Finite),
    median: Schema.NullOr(Schema.Finite),
    nps: Schema.optionalKey(
      Schema.Struct({
        promoters: Count,
        passives: Count,
        detractors: Count,
        /** Answered responses of the versions whose snapshot uses the NPS display. */
        answered: Count,
        /** Promoters' share minus detractors' share, in percentage points. Null when nobody answered. */
        score: Schema.NullOr(Schema.Int),
      }),
    ),
  }),
  Schema.Struct({ type: Schema.Literals(["text", "email", "date"]) }),
  Schema.Struct({
    type: Schema.Literal("ranking"),
    options: Schema.Array(
      Schema.Struct({
        value: Schema.String,
        label: Schema.String,
        otherLabels: OtherLabels,
        /** Mean 1-based place. Null when no answered response offered the option. */
        meanPosition: Schema.NullOr(Schema.Finite),
        /** How often the option was placed first. */
        firstPlace: Count,
        /** Answered responses of the versions that offered the option. */
        base: Count,
        offeredIn: VersionNumbers,
      }),
    ),
  }),
]).annotate({ identifier: "AnalyticsSummary" });
export type AnalyticsSummary = typeof AnalyticsSummary.Type;

/** A version's own constraints on a number or multiple-choice question. */
export const AnalyticsConstraints = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("number"),
    integer: Schema.Boolean,
    min: Schema.NullOr(Schema.Finite),
    max: Schema.NullOr(Schema.Finite),
  }),
  Schema.Struct({
    type: Schema.Literal("multiple_choice"),
    minSelected: Schema.NullOr(Schema.Int),
    maxSelected: Schema.NullOr(Schema.Int),
  }),
]).annotate({ identifier: "AnalyticsConstraints" });
export type AnalyticsConstraints = typeof AnalyticsConstraints.Type;

/** Absent versions carry no counts: a question a version lacked was never skipped there. */
const VersionAnalytics = Schema.Union([
  Schema.Struct({ version: Schema.Int, present: Schema.Literal(false) }),
  Schema.Struct({
    version: Schema.Int,
    present: Schema.Literal(true),
    responses: Count,
    answered: Count,
    skipped: Count,
    summary: AnalyticsSummary,
    constraints: Schema.NullOr(AnalyticsConstraints),
  }),
]);

/** One question identity across every version, combined, with the per-version breakdown beside it. */
export const QuestionAnalytics = Schema.Struct({
  questionId: Schema.String,
  type: QuestionTypeName,
  label: Schema.String,
  otherLabels: OtherLabels,
  inCurrentVersion: Schema.Boolean,
  combined: Schema.Struct({
    responses: Count,
    answered: Count,
    skipped: Count,
    /** The responses of versions without the question. */
    absentResponses: Count,
    summary: AnalyticsSummary,
  }),
  byVersion: Schema.Array(VersionAnalytics),
}).annotate({ identifier: "QuestionAnalytics" });
export type QuestionAnalytics = typeof QuestionAnalytics.Type;

/** A form's analytics, with no prose: versions are referenced by number, and `versions` maps them to ids. */
export const FormAnalytics = Schema.Struct({
  formId: Schema.String,
  totalResponses: Count,
  /** Every version, ascending. */
  versions: Schema.Array(
    Schema.Struct({
      versionId: Schema.String,
      number: Schema.Int,
      publishedAt: Schema.Date,
      responses: Count,
    }),
  ),
  /** The current version's questions in its order, then dropped ones, most recently dropped first. */
  questions: Schema.Array(QuestionAnalytics),
}).annotate({ identifier: "FormAnalytics" });
export type FormAnalytics = typeof FormAnalytics.Type;

export const FormDetail = Schema.Struct({
  id: Schema.String,
  availability: Availability,
  responseLimit: ResponseLimit,
  currentVersion: Schema.NullOr(VersionSummary),
  draft: Schema.NullOr(DraftSummary),
  /** Sorted by namespace, then `refId`. */
  externalRefs: Schema.Array(ExternalRef),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
}).annotate({ identifier: "FormDetail" });
export type FormDetail = typeof FormDetail.Type;
