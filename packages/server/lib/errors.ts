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
