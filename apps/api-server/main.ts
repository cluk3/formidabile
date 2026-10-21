import { NodeRuntime } from "@effect/platform-node";
import { DatabaseLive } from "@fb/server/database";
import { Config, Effect, Layer } from "effect";
import { ServerLive } from "./server.ts";

const MainLive = Layer.unwrap(
  Effect.gen(function* () {
    const databaseUrl = yield* Config.String("DATABASE_URL");
    const port = yield* Config.Port("PORT").pipe(Config.withDefault(3000));
    return ServerLive({ port }).pipe(Layer.provide(DatabaseLive(databaseUrl)));
  }),
);

Layer.launch(MainLive).pipe(NodeRuntime.runMain);
