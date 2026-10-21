import {
  Analytics,
  Drafts,
  FormModuleLive,
  Forms,
  Publication,
  Responses,
  Submission,
} from "@fb/server";
import { Effect, Layer } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import { answerJsonSchema } from "./answer-schema.ts";
import { CurrentActor, FormApi } from "./api.ts";
import { AuthenticationLive, BodyLimitsLive, EdgeValidationLive } from "./middleware.ts";

const FormsHandlers = HttpApiBuilder.group(
  FormApi,
  "forms",
  Effect.fn(function* (handlers) {
    const forms = yield* Forms;
    return handlers
      .handle("create", ({ payload }) =>
        CurrentActor.use((actor) => forms.create(actor, payload.definition)),
      )
      .handle("list", ({ query: { refNamespace, refId } }) =>
        CurrentActor.use((actor) =>
          Effect.map(
            forms.list(
              actor,
              refNamespace === undefined || refId === undefined
                ? undefined
                : { namespace: refNamespace, refId },
            ),
            (list) => ({ forms: list }),
          ),
        ),
      )
      .handle("detail", ({ params }) =>
        CurrentActor.use((actor) => forms.detail(actor, params.formId)),
      )
      .handle("updateSettings", ({ params, payload }) =>
        CurrentActor.use((actor) => forms.updateSettings(actor, params.formId, payload)),
      )
      .handle("delete", ({ params, query }) =>
        CurrentActor.use((actor) => forms.delete(actor, params.formId, query.expectedRevision)),
      )
      .handle("addExternalRef", ({ params, payload }) =>
        CurrentActor.use((actor) =>
          Effect.map(forms.addExternalRef(actor, params.formId, payload), (externalRefs) => ({
            externalRefs,
          })),
        ),
      )
      .handle("removeExternalRef", ({ params, query }) =>
        CurrentActor.use((actor) =>
          Effect.map(forms.removeExternalRef(actor, params.formId, query), (externalRefs) => ({
            externalRefs,
          })),
        ),
      );
  }),
);

const DraftsHandlers = HttpApiBuilder.group(
  FormApi,
  "drafts",
  Effect.fn(function* (handlers) {
    const drafts = yield* Drafts;
    const publication = yield* Publication;
    return handlers
      .handle("read", ({ params }) =>
        CurrentActor.use((actor) =>
          Effect.map(drafts.read(actor, params.formId), (draft) => ({ draft })),
        ),
      )
      .handle("save", ({ params, payload }) =>
        CurrentActor.use((actor) => drafts.save(actor, params.formId, payload)),
      )
      .handle("discard", ({ params, query }) =>
        CurrentActor.use((actor) => drafts.discard(actor, params.formId, query.expectedRevision)),
      )
      .handle("publish", ({ params, payload }) =>
        CurrentActor.use((actor) =>
          publication.publish(actor, params.formId, payload.expectedRevision),
        ),
      );
  }),
);

const VersionsHandlers = HttpApiBuilder.group(
  FormApi,
  "versions",
  Effect.fn(function* (handlers) {
    const publication = yield* Publication;
    return handlers
      .handle("list", ({ params }) =>
        CurrentActor.use((actor) =>
          Effect.map(publication.versions(actor, params.formId), (versions) => ({ versions })),
        ),
      )
      .handle("read", ({ params }) =>
        CurrentActor.use((actor) => publication.version(actor, params.formId, params.versionId)),
      );
  }),
);

const RespondHandlers = HttpApiBuilder.group(
  FormApi,
  "respond",
  Effect.fn(function* (handlers) {
    const submission = yield* Submission;
    return handlers
      .handle("load", ({ params }) =>
        CurrentActor.use((actor) => submission.load(actor, params.formId)),
      )
      .handle("answerSchema", ({ params }) =>
        CurrentActor.use((actor) =>
          Effect.map(submission.version(actor, params.formId, params.versionId), answerJsonSchema),
        ),
      )
      .handle("submit", ({ params, payload }) =>
        CurrentActor.use((actor) => submission.submit(actor, params.formId, payload)),
      )
      .handle("readResponse", ({ params }) =>
        CurrentActor.use((actor) => submission.read(actor, params.responseId)),
      )
      .handle("editResponse", ({ params, payload }) =>
        CurrentActor.use((actor) => submission.edit(actor, params.responseId, payload)),
      );
  }),
);

const ResponsesHandlers = HttpApiBuilder.group(
  FormApi,
  "responses",
  Effect.fn(function* (handlers) {
    const responses = yield* Responses;
    return handlers
      .handle("list", ({ query: { refNamespace, refId, ...query } }) =>
        CurrentActor.use((actor) =>
          responses.list(actor, {
            ...query,
            ref:
              refNamespace === undefined || refId === undefined
                ? undefined
                : { namespace: refNamespace, refId },
          }),
        ),
      )
      .handle("read", ({ params }) =>
        CurrentActor.use((actor) => responses.read(actor, params.responseId)),
      )
      .handle("delete", ({ params }) =>
        CurrentActor.use((actor) => responses.delete(actor, params.responseId)),
      )
      .handle("deleteByRespondent", ({ params }) =>
        CurrentActor.use((actor) => responses.deleteByRespondent(actor, params.respondentId)),
      );
  }),
);

const AnalyticsHandlers = HttpApiBuilder.group(
  FormApi,
  "analytics",
  Effect.fn(function* (handlers) {
    const analytics = yield* Analytics;
    return handlers.handle("form", ({ params }) =>
      CurrentActor.use((actor) => analytics.form(actor, params.formId)),
    );
  }),
);

/**
 * Router options for serving `FormApiLive`. The router 404s a path parameter longer than `maxParamLength` UTF-16
 * units (100 by default) before its schema sees it, which would refuse a valid 255-code-point `respondentId`.
 * Node's default 16 KiB header limit already bounds the request line.
 */
export const FormApiRouterConfig = { maxParamLength: 16 * 1024 } as const;

/** The whole API, given a `Database` and an `ActorResolver`; serve it with `FormApiRouterConfig`. */
export const FormApiLive = HttpApiBuilder.layer(FormApi).pipe(
  Layer.provide([
    FormsHandlers,
    DraftsHandlers,
    VersionsHandlers,
    RespondHandlers,
    ResponsesHandlers,
    AnalyticsHandlers,
  ]),
  Layer.provide([FormModuleLive, AuthenticationLive, EdgeValidationLive, BodyLimitsLive]),
);
