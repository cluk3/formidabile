import { ValidationFailed } from "@fb/server";
import { ActorResolver, authenticate } from "@fb/server/actor";
import { Effect, Layer, SchemaIssue } from "effect";
import { HttpServerRequest } from "effect/http";
import { HttpApiMiddleware } from "effect/http-api";
import { Authentication, CurrentActor, EdgeValidation } from "./api.ts";

export const AuthenticationLive = Layer.effect(
  Authentication,
  Effect.gen(function* () {
    const resolver = yield* ActorResolver;
    return Authentication.of({
      bearer: (httpEffect) =>
        HttpServerRequest.HttpServerRequest.use(authenticate).pipe(
          Effect.provideService(ActorResolver, resolver),
          Effect.flatMap((actor) => Effect.provideService(httpEffect, CurrentActor, actor)),
        ),
    });
  }),
);

const formatIssues = SchemaIssue.makeFormatterStandardSchemaV1();

export const EdgeValidationLive = HttpApiMiddleware.layerSchemaErrorTransform(
  EdgeValidation,
  (error) =>
    // `Body` and `ResponseHeaders` are the server's own encoding failures, and stay 500s.
    error.kind === "Body" || error.kind === "ResponseHeaders"
      ? Effect.fail(error)
      : Effect.fail(
          new ValidationFailed({
            issues: formatIssues(error.cause.issue).issues.map(({ path, message }) => ({
              path: (path ?? []).map((segment) => {
                const key = typeof segment === "object" ? segment.key : segment;
                return typeof key === "number" ? key : String(key);
              }),
              message,
            })),
          }),
        ),
);
