import { Layer } from "effect";
import { Analytics } from "./lib/analytics/analytics.ts";
import { Drafts } from "./lib/drafts/drafts.ts";
import { Forms } from "./lib/forms/forms.ts";
import { Publication } from "./lib/publication/publication.ts";
import { Responses } from "./lib/responses/responses.ts";
import { Submission } from "./lib/submission/submission.ts";

export { mergeAnalytics, type AnalyticsCounts } from "./lib/analytics/merge.ts";
export {
  AnalyticsConstraints,
  AnalyticsSummary,
  AnswersJson,
  Availability,
  DeletedResponses,
  Draft,
  DraftSummary,
  EditedResponse,
  Form,
  FormAnalytics,
  FormDefinitionJson,
  FormDetail,
  FormSettings,
  FormSummary,
  FormVersion,
  QuestionAnalytics,
  RespondentForm,
  RespondentResponse,
  ResponseDetail,
  ResponseLimit,
  ResponsePage,
  ResponseSummary,
  SubmittedResponse,
  VersionSummary,
} from "./lib/envelopes.ts";
export {
  AlreadyResponded,
  ExternalRefLimitReached,
  Forbidden,
  FormClosed,
  FormNotPublished,
  FormPublished,
  Issue,
  NoDraft,
  NotFound,
  RevisionConflict,
  ValidationFailed,
  VersionSuperseded,
} from "./lib/errors.ts";
export type { SaveDraft } from "./lib/drafts/drafts.ts";
export type { ListResponses } from "./lib/responses/responses.ts";
export type { EditResponse, SubmitResponse } from "./lib/submission/submission.ts";
export { Analytics, Drafts, Forms, Publication, Responses, Submission };

/** Every use case, given a `Database`. */
export const FormModuleLive = Layer.mergeAll(
  Forms.layer,
  Drafts.layer,
  Publication.layer,
  Submission.layer,
  Responses.layer,
  Analytics.layer,
);
