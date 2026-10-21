import { FormModuleLive, Forms } from "@fb/server";
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
      );
  }),
);

/** The whole API, given a `Database` and an `ActorResolver`. */
export const FormApiLive = HttpApiBuilder.layer(FormApi).pipe(
  Layer.provide(FormsHandlers),
  Layer.provide([FormModuleLive, AuthenticationLive, EdgeValidationLive]),
);
