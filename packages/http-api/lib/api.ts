import { FormDefinition } from "@fb/core/definition";
import {
  Draft,
  Forbidden,
  Form,
  FormDefinitionJson,
  FormDetail,
  FormSummary,
  NotFound,
  ValidationFailed,
} from "@fb/server";
import { type Actor, Unauthenticated } from "@fb/server/actor";
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
import { toJSONSchema } from "zod/mini";

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

const FormIdParams = { formId: Schema.String.check(Schema.isUUID()) };

export class FormsGroup extends HttpApiGroup.make("forms")
  .add(
    HttpApiEndpoint.post("create", "/forms", {
      payload: Schema.Struct({ definition: FormDefinitionJson }),
      success: Schema.Struct({ form: Form, draft: Draft }).pipe(HttpApiSchema.status(201)),
      error: [Forbidden, ValidationFailed],
    }),
    HttpApiEndpoint.get("list", "/forms", {
      success: Schema.Struct({ forms: Schema.Array(FormSummary) }),
      error: Forbidden,
    }),
    HttpApiEndpoint.get("detail", "/forms/:formId", {
      params: FormIdParams,
      success: FormDetail,
      error: [Forbidden, NotFound],
    }),
  )
  .middleware(EdgeValidation)
  .middleware(Authentication) {}

export class FormApi extends HttpApi.make("FormApi")
  .add(FormsGroup)
  .annotateMerge(
    OpenApi.annotations({
      title: "Form module API",
      version: "0.1.0",
      // `FormDefinitionJson` is plain JSON to Effect. Zod's JSON Schema documents it, and `@fb/core` parses it.
      transform: (spec) => {
        const { $schema: _, ...schema } = toJSONSchema(FormDefinition, {
          target: "draft-2020-12",
          io: "input",
        });
        spec.components.schemas.FormDefinition = schema;
        return spec;
      },
    }),
  ) {}
