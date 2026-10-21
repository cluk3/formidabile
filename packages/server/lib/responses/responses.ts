import { Context, Effect, Layer } from "effect";
import type { Actor } from "../authorization/actor.ts";
import { requireCapability } from "../authorization/authorization.ts";
import type { ResponseDetail, ResponsePage } from "../envelopes.ts";
import { type Forbidden, NotFound } from "../errors.ts";
import { Database, dieOnDatabaseError } from "../persistence/database.ts";
import {
  findResponse,
  findResponseAnswers,
  findResponseRefs,
  listResponses,
  type ResponseFilter,
} from "../persistence/responses.ts";

const defaultLimit = 50;

/** The edge holds `limit` to 1 to 200 (ADR 0015). */
export interface ListResponses extends ResponseFilter {
  /** The previous page's `nextCursor`. */
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
}

/** One snapshot per call, so a page's references and a read's answers belong to the rows beside them. */
const readOnly = { isolationLevel: "repeatable read", accessMode: "read only" } as const;

export class Responses extends Context.Service<
  Responses,
  {
    /** The tenant's responses, newest first, a page at a time. */
    readonly list: (actor: Actor, query: ListResponses) => Effect.Effect<ResponsePage, Forbidden>;
    /** One response with raw answers, embedding the version it was submitted under (ADR 0001 §8.1). */
    readonly read: (
      actor: Actor,
      responseId: string,
    ) => Effect.Effect<ResponseDetail, Forbidden | NotFound>;
  }
>()("@fb/server/Responses") {
  static readonly layer = Layer.effect(
    Responses,
    Effect.gen(function* () {
      const db = yield* Database;
      return Responses.of({
        list: Effect.fn("Responses.list")(function* (
          actor,
          { cursor, limit = defaultLimit, ...filter },
        ) {
          const { tenant } = yield* requireCapability(actor, "responses:read");
          return yield* db
            .transaction(
              (tx) =>
                Effect.gen(function* () {
                  // One extra row tells whether another page follows.
                  const rows = yield* listResponses(tx, tenant, filter, {
                    cursor,
                    limit: limit + 1,
                  });
                  const page = rows.slice(0, limit);
                  const refs = yield* findResponseRefs(
                    tx,
                    page.map((row) => row.id),
                  );
                  return {
                    responses: page.map((row) => ({
                      ...row,
                      externalRefs: refs.get(row.id) ?? [],
                    })),
                    nextCursor: rows.length > limit ? page.at(-1)!.id : null,
                  } satisfies ResponsePage;
                }),
              readOnly,
            )
            .pipe(dieOnDatabaseError);
        }),
        read: Effect.fn("Responses.read")(function* (actor, responseId) {
          const { tenant } = yield* requireCapability(actor, "responses:read");
          return yield* db
            .transaction(
              (tx) =>
                Effect.gen(function* () {
                  const found = yield* findResponse(tx, tenant, responseId);
                  if (found === undefined) return yield* new NotFound();
                  const { response, definition } = found;
                  const refs = yield* findResponseRefs(tx, [response.id]);
                  return {
                    response: {
                      ...response,
                      externalRefs: refs.get(response.id) ?? [],
                      answers: yield* findResponseAnswers(tx, response.id),
                    },
                    version: { id: response.versionId, number: response.versionNumber, definition },
                  } satisfies ResponseDetail;
                }),
              readOnly,
            )
            .pipe(dieOnDatabaseError);
        }),
      });
    }),
  );
}
