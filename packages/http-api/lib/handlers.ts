import { Drafts, FormModuleLive, Forms, Publication } from "@fb/server";
import { Effect, Layer } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import { CurrentActor, FormApi } from "./api.ts";
import { AuthenticationLive, EdgeValidationLive } from "./middleware.ts";

const FormsHandlers = HttpApiBuilder.group(
  FormApi,
  "forms",
  Effect.fn(function* (handlers) {
    const forms = yield* Forms;
    return handlers
      .handle("create", ({ payload }) =>
        CurrentActor.use((actor) => forms.create(actor, payload.definition)),
      )
      .handle("list", () =>
        CurrentActor.use((actor) => Effect.map(forms.list(actor), (list) => ({ forms: list }))),
      )
      .handle("detail", ({ params }) =>
        CurrentActor.use((actor) => forms.detail(actor, params.formId)),
      )
      .handle("updateSettings", ({ params, payload }) =>
        CurrentActor.use((actor) => forms.updateSettings(actor, params.formId, payload)),
      )
      .handle("delete", ({ params, query }) =>
        CurrentActor.use((actor) => forms.delete(actor, params.formId, query.expectedRevision)),
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

/** The whole API, given a `Database` and an `ActorResolver`. */
export const FormApiLive = HttpApiBuilder.layer(FormApi).pipe(
  Layer.provide([FormsHandlers, DraftsHandlers, VersionsHandlers]),
  Layer.provide([FormModuleLive, AuthenticationLive, EdgeValidationLive]),
);
