import { ValidationFailed } from "@fb/server";
import { ActorResolver, authenticate } from "@fb/server/actor";
import { Context, Effect, Layer, Option, Schema, SchemaIssue, SchemaTransformation } from "effect";
import { HttpServerRequest } from "effect/http";
import { HttpApiMiddleware } from "effect/http-api";
import {
  Authentication,
  BodyLimit,
  BodyLimits,
  CurrentActor,
  EdgeValidation,
  LengthRequired,
  PayloadTooLarge,
} from "./api.ts";

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

/** `Content-Length` is one or more decimal digits (RFC 9110 §8.6). */
const contentLength = Schema.decodeUnknownOption(
  Schema.String.check(Schema.isPattern(/^\d+$/)).pipe(
    Schema.decodeTo(Schema.Number, SchemaTransformation.numberFromString),
  ),
);

export const BodyLimitsLive = Layer.succeed(
  BodyLimits,
  Effect.fnUntraced(function* (httpEffect, { endpoint }) {
    const { headers } = yield* HttpServerRequest.HttpServerRequest;
    const declared = headers["content-length"];
    // A request carries a body if its endpoint takes one or its framing headers announce one.
    if (
      endpoint.payload.size > 0 ||
      declared !== undefined ||
      headers["transfer-encoding"] !== undefined
    ) {
      const length = contentLength(declared);
      if (Option.isNone(length)) return yield* new LengthRequired();
      const limit = Context.get(endpoint.annotations, BodyLimit);
      if (length.value > limit) return yield* new PayloadTooLarge({ limit });
    }
    return yield* httpEffect;
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
