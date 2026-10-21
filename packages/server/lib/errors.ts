import { Schema } from "effect";
import { Capability } from "./authorization/actor.ts";

export class Forbidden extends Schema.TaggedError<Forbidden>()(
  "Forbidden",
  { capability: Capability },
  { httpApiStatus: 403 },
) {}

/** Also what another tenant's resource gives, so a 404 never confirms that an id exists. */
export class NotFound extends Schema.TaggedError<NotFound>()(
  "NotFound",
  {},
  { httpApiStatus: 404 },
) {}

/** The draft changed since the caller read it: reload or stay, never overwrite. */
export class RevisionConflict extends Schema.TaggedError<RevisionConflict>()(
  "RevisionConflict",
  {},
  { httpApiStatus: 409 },
) {}

/** A save with a non-null `expectedRevision`, a discard or a publish found no draft. */
export class NoDraft extends Schema.TaggedError<NoDraft>()("NoDraft", {}, { httpApiStatus: 409 }) {}

export class FormNotPublished extends Schema.TaggedError<FormNotPublished>()(
  "FormNotPublished",
  {},
  { httpApiStatus: 409 },
) {}

/** A form with any published version is permanent: close it instead (ADR 0014). */
export class FormPublished extends Schema.TaggedError<FormPublished>()(
  "FormPublished",
  {},
  { httpApiStatus: 409 },
) {}

/** A form holds at most `limit` external references. */
export class ExternalRefLimitReached extends Schema.TaggedError<ExternalRefLimitReached>()(
  "ExternalRefLimitReached",
  { limit: Schema.Int },
  { httpApiStatus: 409 },
) {}

export const Issue = Schema.Struct({
  path: Schema.Array(Schema.Union([Schema.String, Schema.Number])),
  message: Schema.String,
});
export type Issue = typeof Issue.Type;

export class ValidationFailed extends Schema.TaggedError<ValidationFailed>()(
  "ValidationFailed",
  { issues: Schema.Array(Issue) },
  { httpApiStatus: 422 },
) {}
