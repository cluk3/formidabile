import { FormModuleLive, Forms, Publication, Submission } from "@fb/server";
import { Actor, TenantId } from "@fb/server/actor";
import { DatabaseTestPostgres } from "@fb/server/testing";
import { Effect, Layer, Option } from "effect";
import { SqlClient } from "effect/sql";
import { expect, test } from "vite-plus/test";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("test:pg needs DATABASE_URL");

const acme = TenantId.make("acme");

const admin = Actor.Identified({
  subject: "acme-admin",
  tenant: acme,
  capabilities: ["forms:manage"],
  formId: Option.none(),
  refs: [],
});

const alice = Actor.Identified({
  subject: "alice",
  tenant: acme,
  capabilities: [],
  formId: Option.none(),
  refs: [],
});

const questionId = crypto.randomUUID();
const definition = {
  format: 1 as const,
  title: "One each",
  questions: [
    { id: questionId, type: "boolean" as const, label: "Ready?", required: true, config: {} },
  ],
};

const rounds = 20;

const run = <A, E>(
  effect: Effect.Effect<A, E, Forms | Publication | Submission | SqlClient.SqlClient>,
) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(FormModuleLive.pipe(Layer.provideMerge(DatabaseTestPostgres(databaseUrl)))),
    ),
  );

/** Opens a one-per-respondent form, then fires two first submissions by one respondent at once. */
const race = Effect.gen(function* () {
  const forms = yield* Forms;
  const publication = yield* Publication;
  const submission = yield* Submission;
  const { form, draft } = yield* forms.create(admin, definition);
  const { version } = yield* publication.publish(admin, form.id, draft.revision);
  yield* forms.updateSettings(admin, form.id, {
    availability: "open",
    responseLimit: "one_per_respondent",
  });
  const submit = Effect.result(
    Effect.suspend(() =>
      submission.submit(alice, form.id, {
        versionId: version.id,
        answers: { [questionId]: true },
        idempotencyKey: crypto.randomUUID(),
      }),
    ),
  );
  return yield* Effect.all([submit, submit], { concurrency: "unbounded" });
});

test("two first submissions racing on a one-per-respondent form leave one response, and the other gets AlreadyResponded", async () => {
  const outcomes = await run(Effect.forEach(Array.from({ length: rounds }), () => race));

  for (const outcome of outcomes) {
    const won = outcome.filter((result) => result._tag === "Success");
    expect(won).toHaveLength(1);
    const lost = outcome.find((result) => result._tag === "Failure");
    expect(lost).toMatchObject({
      failure: { _tag: "AlreadyResponded", responseId: won[0]!.success.responseId },
    });
  }
}, 60_000);

/** Opens an unlimited form, then fires two submits with one key at once. */
const replayRace = Effect.gen(function* () {
  const forms = yield* Forms;
  const publication = yield* Publication;
  const submission = yield* Submission;
  const { form, draft } = yield* forms.create(admin, definition);
  const { version } = yield* publication.publish(admin, form.id, draft.revision);
  yield* forms.updateSettings(admin, form.id, { availability: "open" });
  const idempotencyKey = crypto.randomUUID();
  const submit = submission.submit(alice, form.id, {
    versionId: version.id,
    answers: { [questionId]: true },
    idempotencyKey,
  });
  const outcome = yield* Effect.all([submit, submit], { concurrency: "unbounded" });
  const [stored] = yield* SqlClient.SqlClient.use(
    (sql) => sql<{ count: number }>`
      SELECT count(*)::int AS count FROM form_management.responses WHERE form_id = ${form.id}
    `,
  );
  return { outcome, count: stored!.count };
});

test("two submits racing with the same key leave one response, and both get it", async () => {
  const races = await run(Effect.forEach(Array.from({ length: rounds }), () => replayRace));

  for (const { outcome, count } of races) {
    expect(count).toBe(1);
    expect(outcome[1]).toEqual(outcome[0]);
  }
}, 60_000);
