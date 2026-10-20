import { Layer } from "effect";
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

export const createFormModuleHandler = (_options: FormModuleHandlerOptions): FormModuleHandler => {
  const { handler, dispose } = HttpRouter.toWebHandler(
    FormApiLive.pipe(Layer.provide(HttpServer.layerServices)),
    { disableLogger: true },
  );
  return {
    fetch: handler,
    migrate: async () => {},
    dispose,
  };
};
