import { Layer } from "effect";
import { Drafts } from "./lib/drafts/drafts.ts";
import { Forms } from "./lib/forms/forms.ts";
import { Publication } from "./lib/publication/publication.ts";

export {
  Availability,
  Draft,
  DraftSummary,
  Form,
  FormDefinitionJson,
  FormDetail,
  FormSummary,
  FormVersion,
  ResponseLimit,
  VersionSummary,
} from "./lib/envelopes.ts";
export {
  Forbidden,
  FormNotPublished,
  Issue,
  NoDraft,
  NotFound,
  RevisionConflict,
  ValidationFailed,
} from "./lib/errors.ts";
export type { SaveDraft } from "./lib/drafts/drafts.ts";
export { Drafts, Forms, Publication };

/** Every use case, given a `Database`. */
export const FormModuleLive = Layer.mergeAll(Forms.layer, Drafts.layer, Publication.layer);
