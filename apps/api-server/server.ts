import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { FormApiLive, FormApiRouterConfig } from "@fb/http-api";
import { migrate } from "@fb/server/migrate";
import { Layer } from "effect";
import { HttpRouter } from "effect/http";

export const ServerLive = (options: { readonly port: number }) =>
  HttpRouter.serve(FormApiLive, { routerConfig: FormApiRouterConfig }).pipe(
    Layer.provideMerge(
      // `NodeHttpServer.layer`'s options only reach `listen`, so ADR 0015's timeouts go on the server itself.
      NodeHttpServer.layer(() => createServer({ headersTimeout: 10_000, requestTimeout: 30_000 }), {
        port: options.port,
      }),
    ),
    Layer.provide(Layer.effectDiscard(migrate)),
  );
