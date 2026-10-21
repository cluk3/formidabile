import { type Actor, ActorResolver, Unauthenticated } from "@fb/server/actor";
import { DatabaseLive } from "@fb/server/database";
import { migrate } from "@fb/server/migrate";
import { Effect, Layer, ManagedRuntime } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import { FormApiLive, JwtActorResolver, type JwtOptions } from "./index.ts";

export type FormModuleHandlerOptions = {
  readonly databaseUrl: string;
  /** Browser origins allowed to call the API, with credentials. */
  readonly cors?: ReadonlyArray<string>;
} & (
  | { readonly jwt: JwtOptions; readonly resolveActor?: undefined }
  | {
      /**
       * The host's own resolver, for example one reading its session cookie. `null` means no credentials.
       * Its actor is held to the same limits as a token's: otherwise 401 `invalid`.
       */
      readonly resolveActor: (request: Request) => Promise<Actor | null>;
      readonly jwt?: undefined;
    }
);

export interface FormModuleHandler {
  readonly fetch: (request: Request) => Promise<Response>;
  readonly migrate: () => Promise<void>;
  readonly dispose: () => Promise<void>;
}

const hostResolver = (resolveActor: (request: Request) => Promise<Actor | null>) =>
  Layer.succeed(ActorResolver, {
    // The Fetch handler hands every resolver the `Request` it was given.
    resolve: (request) =>
      Effect.promise(() => resolveActor(request.source as Request)).pipe(
        Effect.flatMap((actor) =>
          actor === null
            ? Effect.fail(new Unauthenticated({ reason: "missing" }))
            : Effect.succeed(actor),
        ),
      ),
  });

export const createFormModuleHandler = (options: FormModuleHandlerOptions): FormModuleHandler => {
  // One memo map, so `migrate()` and the handler share one connection pool.
  const memoMap = Layer.makeMemoMapUnsafe();
  const database = DatabaseLive(options.databaseUrl);
  const runtime = ManagedRuntime.make(database, { memoMap });
  const resolver =
    options.resolveActor === undefined
      ? JwtActorResolver(options.jwt)
      : hostResolver(options.resolveActor);
  const routes =
    options.cors === undefined
      ? FormApiLive
      : Layer.merge(
          FormApiLive,
          HttpRouter.cors({ allowedOrigins: options.cors, credentials: true }),
        );
  // Built on the first request: building opens the pool, which would keep a process that never serves alive.
  let web:
    | {
        readonly handler: (request: Request) => Promise<Response>;
        readonly dispose: () => Promise<void>;
      }
    | undefined;
  const app = () =>
    (web ??= HttpRouter.toWebHandler(
      routes.pipe(Layer.provide([resolver, database]), Layer.provide(HttpServer.layerServices)),
      { memoMap, disableLogger: true },
    ));
  return {
    fetch: (request) => app().handler(request),
    migrate: () => runtime.runPromise(migrate),
    dispose: async () => {
      await web?.dispose();
      await runtime.dispose();
    },
  };
};
