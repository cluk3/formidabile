import { Drafts, FormModuleLive, Forms, Publication, Submission } from "@fb/server";
import { Actor, type ExternalRef, TenantId } from "@fb/server/actor";
import { DatabaseTest } from "@fb/server/testing";
import { Effect, Layer, Option } from "effect";
import { SqlClient } from "effect/sql";
import { describe, expect, test } from "vite-plus/test";

const acme = TenantId.make("acme");

const admin = Actor.Identified({
  subject: "acme-admin",
  tenant: acme,
  capabilities: ["forms:manage"],
  formId: Option.none(),
  refs: [],
});

const respondent = (
  subject: string,
  binding: { formId?: string; refs?: ReadonlyArray<ExternalRef> } = {},
) =>
  Actor.Identified({
    subject,
    tenant: acme,
    capabilities: [],
    formId: Option.fromNullishOr(binding.formId),
    refs: binding.refs ?? [],
  });

const alice = respondent("alice");

const nameId = "0192f5a0-7c3e-7b1a-9d2e-000000000001";
const readyId = "0192f5a0-7c3e-7b1a-9d2e-000000000002";

const definition = (title: string) => ({
  format: 1 as const,
  title,
  questions: [
    {
      id: nameId,
      type: "text" as const,
      label: "Your name",
      required: false,
      config: { display: "single_line" as const },
    },
    { id: readyId, type: "boolean" as const, label: "Ready?", required: true, config: {} },
  ],
});

const answers = { [readyId]: true };

const run = <A, E>(
  effect: Effect.Effect<
    A,
    E,
    Forms | Drafts | Publication | Submission | Layer.Success<typeof DatabaseTest>
  >,
) =>
  Effect.runPromise(
    effect.pipe(Effect.provide(FormModuleLive.pipe(Layer.provideMerge(DatabaseTest)))),
  );

/** Publishes the form's draft as its next version. */
const publish = (formId: string, title: string) =>
  Effect.gen(function* () {
    const drafts = yield* Drafts;
    const publication = yield* Publication;
    const draft = yield* drafts.save(admin, formId, {
      expectedRevision: (yield* drafts.read(admin, formId))?.revision ?? null,
      definition: definition(title),
    });
    return (yield* publication.publish(admin, formId, draft.revision)).version;
  });

/** An open, unlimited form with one published version. */
const openForm = Effect.gen(function* () {
  const forms = yield* Forms;
  const publication = yield* Publication;
  const { form, draft } = yield* forms.create(admin, definition("Survey"));
  const { version } = yield* publication.publish(admin, form.id, draft.revision);
  yield* forms.updateSettings(admin, form.id, { availability: "open" });
  return { formId: form.id, v1: version };
});

const submit = (actor: Actor, formId: string, versionId: string, given: unknown = answers) =>
  Submission.use((submission) =>
    submission.submit(actor, formId, {
      versionId,
      answers: given,
      idempotencyKey: crypto.randomUUID(),
    }),
  );

const storedResponse = (responseId: string) =>
  SqlClient.SqlClient.use(
    (sql) => sql<{ versionId: string; respondentId: string | null; idempotencyKey: string }>`
      SELECT version_id AS "versionId", respondent_id AS "respondentId", idempotency_key AS "idempotencyKey"
      FROM form_management.responses WHERE id = ${responseId}
    `,
  ).pipe(Effect.map(([row]) => row));

const storedAnswers = (responseId: string) =>
  SqlClient.SqlClient.use(
    (sql) => sql<{ questionId: string; value: unknown }>`
      SELECT question_id AS "questionId", value FROM form_management.answers
      WHERE response_id = ${responseId} ORDER BY question_id
    `,
  );

const storedRefs = (responseId: string) =>
  SqlClient.SqlClient.use(
    (sql) => sql<ExternalRef>`
      SELECT namespace, ref_id AS "refId" FROM form_management.response_external_refs
      WHERE response_id = ${responseId} ORDER BY namespace, ref_id
    `,
  );

const responseCount = (formId: string) =>
  SqlClient.SqlClient.use(
    (sql) => sql<{ count: number }>`
      SELECT count(*)::int AS count FROM form_management.responses WHERE form_id = ${formId}
    `,
  ).pipe(Effect.map(([row]) => row!.count));

describe("load", () => {
  test("gives the current published version, the limit and who is responding", async () => {
    const { loaded, v2 } = await run(
      Effect.gen(function* () {
        const { formId } = yield* openForm;
        const v2 = yield* publish(formId, "Survey, revised");
        const loaded = yield* Submission.use((submission) => submission.load(alice, formId));
        return { loaded, v2: { ...v2, formId } };
      }),
    );

    expect(loaded).toEqual({
      formId: v2.formId,
      responseLimit: "unlimited",
      respondent: "identified",
      version: { id: v2.id, number: 2, definition: definition("Survey, revised") },
      myResponseId: null,
    });
  });

  test("points an identified respondent at their response on a one-per-respondent form", async () => {
    const { loaded, responseId } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm;
        yield* Forms.use((forms) =>
          forms.updateSettings(admin, formId, { responseLimit: "one_per_respondent" }),
        );
        const { responseId } = yield* submit(alice, formId, v1.id);
        const loaded = yield* Submission.use((submission) => submission.load(alice, formId));
        return { loaded, responseId };
      }),
    );

    expect(loaded.responseLimit).toBe("one_per_respondent");
    expect(loaded.myResponseId).toBe(responseId);
  });

  test("a closed form gives FormClosed, and a never-published one FormNotPublished", async () => {
    const { closed, unpublished } = await run(
      Effect.gen(function* () {
        const forms = yield* Forms;
        const submission = yield* Submission;
        const { formId } = yield* openForm;
        yield* forms.updateSettings(admin, formId, { availability: "closed" });
        const { form } = yield* forms.create(admin, definition("Never published"));
        return {
          closed: yield* Effect.flip(submission.load(alice, formId)),
          unpublished: yield* Effect.flip(submission.load(alice, form.id)),
        };
      }),
    );

    expect(closed._tag).toBe("FormClosed");
    expect(unpublished._tag).toBe("FormNotPublished");
  });

  test("another tenant's form, and an unknown one, give NotFound", async () => {
    const { otherTenant, unknown } = await run(
      Effect.gen(function* () {
        const submission = yield* Submission;
        const { formId } = yield* openForm;
        const outsider = Actor.Identified({
          subject: "alice",
          tenant: TenantId.make("globex"),
          capabilities: [],
          formId: Option.none(),
          refs: [],
        });
        return {
          otherTenant: yield* Effect.flip(submission.load(outsider, formId)),
          unknown: yield* Effect.flip(submission.load(alice, crypto.randomUUID())),
        };
      }),
    );

    expect(otherTenant._tag).toBe("NotFound");
    expect(unknown._tag).toBe("NotFound");
  });
});

describe("submit", () => {
  test("stores the response on the version it was given, with the answers as validated", async () => {
    const { submitted, stored, storedAnswerRows, key, v1 } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm;
        const key = crypto.randomUUID();
        const submitted = yield* Submission.use((submission) =>
          submission.submit(alice, formId, {
            versionId: v1.id,
            answers: { [nameId]: "  Alice  ", [readyId]: false },
            idempotencyKey: key,
          }),
        );
        return {
          submitted,
          key,
          v1,
          stored: yield* storedResponse(submitted.responseId),
          storedAnswerRows: yield* storedAnswers(submitted.responseId),
        };
      }),
    );

    expect(submitted).toEqual({ responseId: expect.any(String), revision: "1" });
    expect(stored).toEqual({ versionId: v1.id, respondentId: "alice", idempotencyKey: key });
    expect(storedAnswerRows).toEqual([
      { questionId: nameId, value: "Alice" },
      { questionId: readyId, value: false },
    ]);
  });

  test("responses on v1 still point at v1 after v2 is published", async () => {
    const { stored, v1 } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm;
        const { responseId } = yield* submit(alice, formId, v1.id);
        yield* publish(formId, "Survey, revised");
        return { stored: yield* storedResponse(responseId), v1 };
      }),
    );

    expect(stored?.versionId).toBe(v1.id);
  });

  test("against a superseded version gives VersionSuperseded with the current version", async () => {
    const { error, v2 } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm;
        const v2 = yield* publish(formId, "Survey, revised");
        return { error: yield* Effect.flip(submit(alice, formId, v1.id)), v2 };
      }),
    );

    expect(error).toMatchObject({ _tag: "VersionSuperseded", currentVersionId: v2.id });
  });

  test("on a one-per-respondent form gives AlreadyResponded with the most recent response", async () => {
    const { error, latest, count } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm;
        // Duplicates collected while the form was unlimited stay as history.
        yield* submit(alice, formId, v1.id);
        // Responses submitted in the same millisecond have no order.
        yield* Effect.sleep("5 millis");
        const latest = yield* submit(alice, formId, v1.id);
        yield* Forms.use((forms) =>
          forms.updateSettings(admin, formId, { responseLimit: "one_per_respondent" }),
        );
        const error = yield* Effect.flip(submit(alice, formId, v1.id));
        yield* submit(respondent("bob"), formId, v1.id);
        return { error, latest: latest.responseId, count: yield* responseCount(formId) };
      }),
    );

    expect(error).toMatchObject({ _tag: "AlreadyResponded", responseId: latest });
    expect(count).toBe(3);
  });

  test("answers that don't fit the version give ValidationFailed, and nothing is stored", async () => {
    const { error, count } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm;
        const error = yield* Effect.flip(submit(alice, formId, v1.id, { [nameId]: "Alice" }));
        return { error, count: yield* responseCount(formId) };
      }),
    );

    expect(error).toMatchObject({ _tag: "ValidationFailed", issues: [{ path: [readyId] }] });
    expect(count).toBe(0);
  });

  test("checks FormClosed, then VersionSuperseded, then AlreadyResponded, then the answers", async () => {
    const tags = await run(
      Effect.gen(function* () {
        const forms = yield* Forms;
        const { formId, v1 } = yield* openForm;
        yield* submit(alice, formId, v1.id);
        yield* forms.updateSettings(admin, formId, { responseLimit: "one_per_respondent" });
        const v2 = yield* publish(formId, "Survey, revised");
        const invalid = { [nameId]: 42 };
        const attempt = (versionId: string) =>
          Effect.flip(submit(alice, formId, versionId, invalid)).pipe(Effect.map((e) => e._tag));

        yield* forms.updateSettings(admin, formId, { availability: "closed" });
        const closed = yield* attempt(v1.id);
        yield* forms.updateSettings(admin, formId, { availability: "open" });
        const superseded = yield* attempt(v1.id);
        const responded = yield* attempt(v2.id);
        yield* forms.updateSettings(admin, formId, { responseLimit: "unlimited" });
        const invalidAnswers = yield* attempt(v2.id);
        return [closed, superseded, responded, invalidAnswers];
      }),
    );

    expect(tags).toEqual([
      "FormClosed",
      "VersionSuperseded",
      "AlreadyResponded",
      "ValidationFailed",
    ]);
  });

  test("stores the actor's refs with the response, and an empty refs stores none", async () => {
    const { withRefs, withoutRefs } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm;
        const refs = [
          { namespace: "crm.account", refId: "A-1" },
          { namespace: "project", refId: "apollo" },
        ];
        const bound = yield* submit(respondent("alice", { formId, refs }), formId, v1.id);
        const unbound = yield* submit(respondent("bob"), formId, v1.id);
        return {
          withRefs: yield* storedRefs(bound.responseId),
          withoutRefs: yield* storedRefs(unbound.responseId),
        };
      }),
    );

    expect(withRefs).toEqual([
      { namespace: "crm.account", refId: "A-1" },
      { namespace: "project", refId: "apollo" },
    ]);
    expect(withoutRefs).toEqual([]);
  });

  test("another tenant's form gives NotFound", async () => {
    const error = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm;
        const outsider = Actor.Identified({
          subject: "alice",
          tenant: TenantId.make("globex"),
          capabilities: [],
          formId: Option.none(),
          refs: [],
        });
        return yield* Effect.flip(submit(outsider, formId, v1.id));
      }),
    );

    expect(error._tag).toBe("NotFound");
  });
});

describe("a replay", () => {
  const submitWithKey = (actor: Actor, formId: string, versionId: string, idempotencyKey: string) =>
    Submission.use((submission) =>
      submission.submit(actor, formId, { versionId, answers, idempotencyKey }),
    );

  test("returns the same response and inserts nothing, even after the form closes or a new version is published", async () => {
    const { original, again, afterPublish, afterClose, count } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm;
        const key = crypto.randomUUID();
        const original = yield* submitWithKey(alice, formId, v1.id, key);
        const again = yield* submitWithKey(alice, formId, v1.id, key);
        yield* publish(formId, "Survey, revised");
        const afterPublish = yield* submitWithKey(alice, formId, v1.id, key);
        yield* Forms.use((forms) =>
          forms.updateSettings(admin, formId, { availability: "closed" }),
        );
        const afterClose = yield* submitWithKey(alice, formId, v1.id, key);
        return { original, again, afterPublish, afterClose, count: yield* responseCount(formId) };
      }),
    );

    expect(again).toEqual(original);
    expect(afterPublish).toEqual(original);
    expect(afterClose).toEqual(original);
    expect(count).toBe(1);
  });

  test("doesn't compare bodies, and carries the response's current revision", async () => {
    const { original, replayed, storedAnswerRows } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm;
        const key = crypto.randomUUID();
        const original = yield* submitWithKey(alice, formId, v1.id, key);
        yield* SqlClient.SqlClient.use(
          (sql) => sql`
            UPDATE form_management.responses SET revision = 2 WHERE id = ${original.responseId}
          `,
        );
        const replayed = yield* Submission.use((submission) =>
          submission.submit(alice, formId, {
            versionId: v1.id,
            answers: { [nameId]: 42 },
            idempotencyKey: key,
          }),
        );
        return { original, replayed, storedAnswerRows: yield* storedAnswers(original.responseId) };
      }),
    );

    expect(replayed).toEqual({ responseId: original.responseId, revision: "2" });
    expect(storedAnswerRows).toEqual([{ questionId: readyId, value: true }]);
  });

  test("on a one-per-respondent form returns the response, not AlreadyResponded", async () => {
    const { original, replayed, count } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm;
        yield* Forms.use((forms) =>
          forms.updateSettings(admin, formId, { responseLimit: "one_per_respondent" }),
        );
        const key = crypto.randomUUID();
        const original = yield* submitWithKey(alice, formId, v1.id, key);
        const replayed = yield* submitWithKey(alice, formId, v1.id, key);
        return { original, replayed, count: yield* responseCount(formId) };
      }),
    );

    expect(replayed).toEqual(original);
    expect(count).toBe(1);
  });

  test("the same key from another identified respondent creates a second response", async () => {
    const { alices, bobs, count } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm;
        const key = crypto.randomUUID();
        const alices = yield* submitWithKey(alice, formId, v1.id, key);
        const bobs = yield* submitWithKey(respondent("bob"), formId, v1.id, key);
        return { alices, bobs, count: yield* responseCount(formId) };
      }),
    );

    expect(bobs.responseId).not.toBe(alices.responseId);
    expect(count).toBe(2);
  });
});

describe("a form-bound actor", () => {
  test("reaches only its form: another one gives NotFound on load and submit", async () => {
    const { load, submitted, count, own } = await run(
      Effect.gen(function* () {
        const submission = yield* Submission;
        const a = yield* openForm;
        const b = yield* openForm;
        const boundToA = respondent("alice", {
          formId: a.formId,
          refs: [{ namespace: "project", refId: "apollo" }],
        });
        return {
          load: yield* Effect.flip(submission.load(boundToA, b.formId)),
          submitted: yield* Effect.flip(submit(boundToA, b.formId, b.v1.id)),
          count: yield* responseCount(b.formId),
          own: (yield* submission.load(boundToA, a.formId)).formId === a.formId,
        };
      }),
    );

    expect(load._tag).toBe("NotFound");
    expect(submitted._tag).toBe("NotFound");
    expect(count).toBe(0);
    expect(own).toBe(true);
  });
});
