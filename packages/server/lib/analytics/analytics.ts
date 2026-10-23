import { Context, Effect, Layer } from "effect";
import type { Actor } from "../authorization/actor.ts";
import { requireCapability } from "../authorization/authorization.ts";
import type { FormAnalytics } from "../envelopes.ts";
import { type Forbidden, NotFound } from "../errors.ts";
import { Database, dieOnDatabaseError, readOnlySnapshot } from "../persistence/database.ts";
import { storedDefinition } from "../persistence/versions.ts";
import { mergeAnalytics } from "./merge.ts";
import {
  answeredPerQuestion,
  npsCounts,
  numbersCombined,
  numbersPerVersion,
  optionCounts,
  rankingPositions,
  responsesPerVersion,
  valueCounts,
} from "./queries.ts";

export class Analytics extends Context.Service<
  Analytics,
  {
    /**
     * A form's analytics, computed on read: one combined view per question identity, with the per-version
     * breakdown (ADR 0009). A never-published form gives empty analytics.
     */
    readonly form: (
      actor: Actor,
      formId: string,
    ) => Effect.Effect<FormAnalytics, Forbidden | NotFound>;
  }
>()("@fb/server/Analytics") {
  static readonly layer = Layer.effect(
    Analytics,
    Effect.gen(function* () {
      const db = yield* Database;
      return Analytics.of({
        form: Effect.fn("Analytics.form")(function* (actor, formId) {
          const { tenant } = yield* requireCapability(actor, "responses:read");
          return yield* db
            .transaction(
              (tx) =>
                Effect.gen(function* () {
                  const versionRows = yield* responsesPerVersion(tx, tenant, formId);
                  if (versionRows.length === 0) return yield* new NotFound();
                  const versions = versionRows.flatMap(
                    ({ id, number, publishedAt, definition, responses }) =>
                      id === null
                        ? []
                        : [
                            {
                              id,
                              number: number!,
                              publishedAt: publishedAt!,
                              responses,
                              definition: storedDefinition(definition!),
                            },
                          ],
                  );
                  const answered = yield* answeredPerQuestion(tx, tenant, formId);
                  const values = yield* valueCounts(tx, tenant, formId);
                  const options = yield* optionCounts(tx, tenant, formId);
                  const numbers = yield* numbersPerVersion(tx, tenant, formId);
                  const combinedNumbers = yield* numbersCombined(tx, tenant, formId);
                  const nps = yield* npsCounts(tx, tenant, formId);
                  const rankings = yield* rankingPositions(tx, tenant, formId);
                  return mergeAnalytics({
                    formId,
                    versions,
                    answered,
                    choices: [...values, ...options],
                    numbers,
                    combinedNumbers,
                    nps,
                    rankings,
                  });
                }),
              // One snapshot for every query, so concurrent submissions and edits can't make `answered`
              // exceed `responses`.
              readOnlySnapshot,
            )
            .pipe(dieOnDatabaseError);
        }),
      });
    }),
  );
}
