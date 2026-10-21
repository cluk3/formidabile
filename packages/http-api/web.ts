import { DatabaseLive } from "@fb/server/database";
import { migrate } from "@fb/server/migrate";
import { Layer, ManagedRuntime } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import { FormApiLive } from "./index.ts";

export interface FormModuleHandlerOptions {
  readonly databaseUrl: string;
}

export interface FormModuleHandler {
  readonly fetch: (request: Request) => Promise<Response>;
  readonly migrate: () => Promise<void>;
  readonly dispose: () => Promise<void>;
}

export const createFormModuleHandler = (options: FormModuleHandlerOptions): FormModuleHandler => {
  const database = ManagedRuntime.make(DatabaseLive(options.databaseUrl));
  const { handler, dispose } = HttpRouter.toWebHandler(
    FormApiLive.pipe(Layer.provide(HttpServer.layerServices)),
    { disableLogger: true },
  );
  return {
    fetch: handler,
    migrate: () => database.runPromise(migrate),
    dispose: async () => {
      await dispose();
      await database.dispose();
    },
  };
};
