import { NodeRuntime } from "@effect/platform-node";
import { JwtActorResolver } from "@fb/http-api";
import { DatabaseLive } from "@fb/server/database";
import { Config, Effect, Layer } from "effect";
import { ServerLive } from "./server.ts";

const MainLive = Layer.unwrap(
  Effect.gen(function* () {
    const databaseUrl = yield* Config.String("DATABASE_URL");
    const port = yield* Config.Port("PORT").pipe(Config.withDefault(3000));
    const issuer = yield* Config.String("JWT_ISSUER");
    const audience = yield* Config.String("JWT_AUDIENCE");
    // An HS256 shared secret, or else the host's JWKS URL.
    const key = yield* Config.String("JWT_SECRET").pipe(
      Config.map((secret) => ({ secret })),
      Config.orElse(() =>
        Config.String("JWT_JWKS_URL").pipe(Config.map((jwksUrl) => ({ jwksUrl }))),
      ),
    );
    return ServerLive({ port }).pipe(
      Layer.provide([DatabaseLive(databaseUrl), JwtActorResolver({ issuer, audience, ...key })]),
    );
  }),
);

Layer.launch(MainLive).pipe(NodeRuntime.runMain);
