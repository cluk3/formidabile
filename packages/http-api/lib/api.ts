import { AnyAnswers } from "@fb/core/answers";
import { FormDefinition } from "@fb/core/definition";
import {
  AlreadyResponded,
  AnswersJson,
  Draft,
  EditedResponse,
  ExternalRefLimitReached,
  Forbidden,
  Form,
  FormClosed,
  FormDefinitionJson,
  FormDetail,
  FormNotPublished,
  FormPublished,
  FormSettings,
  FormSummary,
  FormVersion,
  NoDraft,
  NotFound,
  RespondentForm,
  RespondentResponse,
  RevisionConflict,
  SubmittedResponse,
  ValidationFailed,
  VersionSummary,
  VersionSuperseded,
} from "@fb/server";
import { type Actor, ExternalRef, Unauthenticated } from "@fb/server/actor";
import { Context, Schema } from "effect";
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity,
  OpenApi,
} from "effect/http-api";
import { toJSONSchema, type z } from "zod/mini";

export class CurrentActor extends Context.Service<CurrentActor, Actor>()(
  "@fb/http-api/CurrentActor",
) {}

/** Resolves the actor through the `ActorResolver`, before any handler runs. */
export class Authentication extends HttpApiMiddleware.Service<
  Authentication,
  { provides: CurrentActor }
>()("@fb/http-api/Authentication", {
  security: { bearer: HttpApiSecurity.bearer },
  error: Unauthenticated,
}) {}

/** Turns request decoding failures, which Effect answers with an empty 400, into `ValidationFailed`. */
export class EdgeValidation extends HttpApiMiddleware.Service<EdgeValidation>()(
  "@fb/http-api/EdgeValidation",
  { error: ValidationFailed },
) {}

export class LengthRequired extends Schema.TaggedError<LengthRequired>()(
  "LengthRequired",
  {},
  { httpApiStatus: 411 },
) {}

export class PayloadTooLarge extends Schema.TaggedError<PayloadTooLarge>()(
  "PayloadTooLarge",
  { limit: Schema.Int },
  { httpApiStatus: 413 },
) {}

/** The most bytes an endpoint's request body may declare (ADR 0015): 16 KiB unless the endpoint says more. */
export const BodyLimit = Context.Reference<number>("@fb/http-api/BodyLimit", {
  defaultValue: () => 16 * 1024,
});

/** Bodies that carry a form definition or answers. */
const largeBody = 1024 * 1024;

/**
 * Refuses a body with no `Content-Length` (411) or one declaring more than the endpoint's `BodyLimit` (413),
 * before any of it is read. Effect's `MaxBodySize` is ignored by Fetch handlers and resets the socket on Node.
 */
export class BodyLimits extends HttpApiMiddleware.Service<BodyLimits>()("@fb/http-api/BodyLimits", {
  error: [LengthRequired, PayloadTooLarge],
}) {}

const FormIdParams = { formId: Schema.String.check(Schema.isUUID()) };
const ResponseIdParams = { responseId: Schema.String.check(Schema.isUUID()) };

/** Revisions travel as opaque strings in the body, or the query for a discard or a delete (ADR 0010). */
const Revision = Schema.String;

/** A lookup by reference names both halves, or neither. */
const FormListQuery = Schema.Struct({
  refNamespace: Schema.optionalKey(ExternalRef.fields.namespace),
  refId: Schema.optionalKey(ExternalRef.fields.refId),
}).check(
  Schema.makeFilter((query) => (query.refNamespace === undefined) === (query.refId === undefined), {
    expected: "refNamespace and refId together",
  }),
);

const ExternalRefs = Schema.Struct({ externalRefs: Schema.Array(ExternalRef) });

export class FormsGroup extends HttpApiGroup.make("forms")
  .add(
    HttpApiEndpoint.post("create", "/forms", {
      payload: Schema.Struct({ definition: FormDefinitionJson }),
      success: Schema.Struct({ form: Form, draft: Draft }).pipe(HttpApiSchema.status(201)),
      error: [Forbidden, ValidationFailed],
    }).annotate(BodyLimit, largeBody),
    HttpApiEndpoint.get("list", "/forms", {
      query: FormListQuery,
      success: Schema.Struct({ forms: Schema.Array(FormSummary) }),
      error: Forbidden,
    }),
    HttpApiEndpoint.get("detail", "/forms/:formId", {
      params: FormIdParams,
      success: FormDetail,
      error: [Forbidden, NotFound],
    }),
    HttpApiEndpoint.patch("updateSettings", "/forms/:formId", {
      params: FormIdParams,
      payload: FormSettings,
      success: Form,
      error: [Forbidden, ValidationFailed, NotFound, FormNotPublished],
    }),
    HttpApiEndpoint.delete("delete", "/forms/:formId", {
      params: FormIdParams,
      query: { expectedRevision: Revision },
      error: [Forbidden, NotFound, FormPublished, RevisionConflict],
    }),
    HttpApiEndpoint.post("addExternalRef", "/forms/:formId/external-refs", {
      params: FormIdParams,
      payload: ExternalRef,
      success: ExternalRefs,
      error: [Forbidden, NotFound, ExternalRefLimitReached],
    }),
    HttpApiEndpoint.delete("removeExternalRef", "/forms/:formId/external-refs", {
      params: FormIdParams,
      query: ExternalRef,
      success: ExternalRefs,
      error: [Forbidden, NotFound],
    }),
  )
  .middleware(EdgeValidation)
  .middleware(Authentication)
  .middleware(BodyLimits) {}

export class DraftsGroup extends HttpApiGroup.make("drafts")
  .add(
    HttpApiEndpoint.get("read", "/forms/:formId/draft", {
      params: FormIdParams,
      success: Schema.Struct({ draft: Schema.NullOr(Draft) }),
      error: [Forbidden, NotFound],
    }),
    HttpApiEndpoint.put("save", "/forms/:formId/draft", {
      params: FormIdParams,
      payload: Schema.Struct({
        expectedRevision: Schema.NullOr(Revision),
        definition: FormDefinitionJson,
      }),
      success: Draft,
      error: [Forbidden, NotFound, ValidationFailed, RevisionConflict, NoDraft],
    }).annotate(BodyLimit, largeBody),
    HttpApiEndpoint.delete("discard", "/forms/:formId/draft", {
      params: FormIdParams,
      query: { expectedRevision: Revision },
      error: [Forbidden, NotFound, FormNotPublished, NoDraft, RevisionConflict],
    }),
    HttpApiEndpoint.post("publish", "/forms/:formId/draft/publish", {
      params: FormIdParams,
      payload: Schema.Struct({ expectedRevision: Revision }),
      success: Schema.Struct({ form: Form, version: VersionSummary }).pipe(
        HttpApiSchema.status(201),
      ),
      error: [Forbidden, NotFound, NoDraft, RevisionConflict, ValidationFailed],
    }),
  )
  .middleware(EdgeValidation)
  .middleware(Authentication)
  .middleware(BodyLimits) {}

export class VersionsGroup extends HttpApiGroup.make("versions")
  .add(
    HttpApiEndpoint.get("list", "/forms/:formId/versions", {
      params: FormIdParams,
      success: Schema.Struct({ versions: Schema.Array(VersionSummary) }),
      error: [Forbidden, NotFound],
    }),
    HttpApiEndpoint.get("read", "/forms/:formId/versions/:versionId", {
      params: { ...FormIdParams, versionId: Schema.String.check(Schema.isUUID()) },
      success: FormVersion,
      error: [Forbidden, NotFound],
    }),
  )
  .middleware(EdgeValidation)
  .middleware(Authentication)
  .middleware(BodyLimits) {}

/** Respondents' operations, under the respondent rules rather than capabilities (ADR 0010). */
export class RespondGroup extends HttpApiGroup.make("respond")
  .add(
    HttpApiEndpoint.get("load", "/respond/forms/:formId", {
      params: FormIdParams,
      success: RespondentForm,
      error: [NotFound, FormNotPublished, FormClosed],
    }),
    HttpApiEndpoint.post("submit", "/respond/forms/:formId/responses", {
      params: FormIdParams,
      // References come only from the token, so `externalRefs` in the body is refused (ADR 0012).
      payload: Schema.Struct({
        versionId: Schema.String.check(Schema.isUUID()),
        answers: AnswersJson,
        idempotencyKey: Schema.String.check(Schema.isUUID()),
      }),
      success: SubmittedResponse.pipe(HttpApiSchema.status(201)),
      error: [
        NotFound,
        Unauthenticated,
        ValidationFailed,
        FormClosed,
        VersionSuperseded,
        AlreadyResponded,
      ],
    })
      .annotate(BodyLimit, largeBody)
      .annotate(HttpApi.PayloadParseOptions, { onExcessProperty: "error" }),
    HttpApiEndpoint.get("readResponse", "/respond/responses/:responseId", {
      params: ResponseIdParams,
      success: RespondentResponse,
      error: [NotFound, Unauthenticated],
    }),
    HttpApiEndpoint.put("editResponse", "/respond/responses/:responseId", {
      params: ResponseIdParams,
      // An edit never changes the references, so `externalRefs` in the body is refused too.
      payload: Schema.Struct({ expectedRevision: Revision, answers: AnswersJson }),
      success: EditedResponse,
      error: [NotFound, Unauthenticated, ValidationFailed, FormClosed, RevisionConflict],
    })
      .annotate(BodyLimit, largeBody)
      .annotate(HttpApi.PayloadParseOptions, { onExcessProperty: "error" }),
  )
  .middleware(EdgeValidation)
  .middleware(Authentication)
  .middleware(BodyLimits) {}

const documented = (schema: z.ZodMiniType) => {
  const { $schema: _, ...json } = toJSONSchema(schema, { target: "draft-2020-12", io: "input" });
  return json;
};

export class FormApi extends HttpApi.make("FormApi")
  .add(FormsGroup)
  .add(DraftsGroup)
  .add(VersionsGroup)
  .add(RespondGroup)
  .annotateMerge(
    OpenApi.annotations({
      title: "Form module API",
      version: "0.1.0",
      // `FormDefinitionJson` and `AnswersJson` are plain JSON to Effect. Zod's JSON Schemas document them, and
      // `@fb/core` parses them.
      transform: (spec) => {
        spec.components.schemas.FormDefinition = documented(FormDefinition);
        spec.components.schemas.AnyAnswers = documented(AnyAnswers);
        return spec;
      },
    }),
  ) {}
