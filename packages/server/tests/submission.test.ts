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
const publish = (formId: string, title: string, ...addedBooleans: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const drafts = yield* Drafts;
    const publication = yield* Publication;
    const { questions, ...rest } = definition(title);
    const draft = yield* drafts.save(admin, formId, {
      expectedRevision: (yield* drafts.read(admin, formId))?.revision ?? null,
      definition: {
        ...rest,
        questions: [
          ...questions,
          ...addedBooleans.map((id) => ({
            id,
            type: "boolean",
            label: "Added",
            required: true,
            config: {},
          })),
        ],
      },
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

const edit = (actor: Actor, responseId: string, expectedRevision: string, given: unknown) =>
  Submission.use((submission) =>
    submission.edit(actor, responseId, { expectedRevision, answers: given }),
  );

const read = (actor: Actor, responseId: string) =>
  Submission.use((submission) => submission.read(actor, responseId));

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

const outsider = (subject: string) =>
  Actor.Identified({
    subject,
    tenant: TenantId.make("globex"),
    capabilities: [],
    formId: Option.none(),
    refs: [],
  });

describe("read", () => {
  test("gives the respondent their answers and revision, the response's version, and whether it's editable", async () => {
    const { open, closed, formId, v1, responseId } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm;
        const { responseId } = yield* submit(alice, formId, v1.id, {
          [nameId]: "Alice",
          [readyId]: true,
        });
        yield* publish(formId, "Survey, revised");
        const open = yield* read(alice, responseId);
        yield* Forms.use((forms) =>
          forms.updateSettings(admin, formId, { availability: "closed" }),
        );
        return { open, closed: yield* read(alice, responseId), formId, v1, responseId };
      }),
    );

    expect(open).toEqual({
      response: {
        id: responseId,
        formId,
        versionId: v1.id,
        revision: "1",
        answers: { [nameId]: "Alice", [readyId]: true },
        submittedAt: expect.any(Date),
        editedAt: null,
      },
      version: { id: v1.id, number: 1, definition: definition("Survey") },
      editable: true,
    });
    expect(closed).toEqual({ ...open, editable: false });
  });

  test("another respondent's response, another tenant's and an unknown one give NotFound", async () => {
    const tags = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm;
        const { responseId } = yield* submit(alice, formId, v1.id);
        const attempt = (actor: Actor, id: string) =>
          Effect.flip(read(actor, id)).pipe(Effect.map((e) => e._tag));
        return [
          yield* attempt(respondent("bob"), responseId),
          yield* attempt(outsider("alice"), responseId),
          yield* attempt(alice, crypto.randomUUID()),
        ];
      }),
    );

    expect(tags).toEqual(["NotFound", "NotFound", "NotFound"]);
  });
});

describe("edit", () => {
  test("overwrites the answers and moves the revision", async () => {
    const { responseId, edited, reread, storedAnswerRows } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm;
        const { responseId, revision } = yield* submit(alice, formId, v1.id, {
          [nameId]: "Alice",
          [readyId]: true,
        });
        return {
          responseId,
          edited: yield* edit(alice, responseId, revision, { [readyId]: false }),
          reread: yield* read(alice, responseId),
          storedAnswerRows: yield* storedAnswers(responseId),
        };
      }),
    );

    expect(edited).toEqual({ responseId, revision: "2", editedAt: expect.any(Date) });
    expect(storedAnswerRows).toEqual([{ questionId: readyId, value: false }]);
    expect(reread.response).toMatchObject({
      revision: "2",
      answers: { [readyId]: false },
      editedAt: edited.editedAt,
    });
  });

  test("a v1 response edited after v2 is published stays on v1 and is validated against it", async () => {
    const { edited, stored, reread, v1 } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm;
        const { responseId, revision } = yield* submit(alice, formId, v1.id);
        yield* publish(formId, "Survey, revised", "0192f5a0-7c3e-7b1a-9d2e-000000000003");
        const edited = yield* edit(alice, responseId, revision, { [readyId]: false });
        return {
          edited,
          v1,
          stored: yield* storedResponse(responseId),
          reread: yield* read(alice, responseId),
        };
      }),
    );

    expect(edited.revision).toBe("2");
    expect(stored?.versionId).toBe(v1.id);
    expect(reread.version).toEqual({ id: v1.id, number: 1, definition: definition("Survey") });
  });

  test("an edit with different refs leaves the stored references unchanged", async () => {
    const { before, after } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm;
        const refs = [{ namespace: "project", refId: "apollo" }];
        const { responseId, revision } = yield* submit(
          respondent("alice", { formId, refs }),
          formId,
          v1.id,
        );
        const before = yield* storedRefs(responseId);
        yield* edit(
          respondent("alice", { formId, refs: [{ namespace: "project", refId: "gemini" }] }),
          responseId,
          revision,
          answers,
        );
        yield* edit(alice, responseId, "2", answers);
        return { before, after: yield* storedRefs(responseId) };
      }),
    );

    expect(before).toEqual([{ namespace: "project", refId: "apollo" }]);
    expect(after).toEqual(before);
  });

  test("a stale expectedRevision gives RevisionConflict and changes nothing", async () => {
    const { error, storedAnswerRows } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm;
        const { responseId, revision } = yield* submit(alice, formId, v1.id);
        yield* edit(alice, responseId, revision, { [readyId]: false });
        const error = yield* Effect.flip(
          edit(alice, responseId, revision, { [nameId]: "Stale", [readyId]: true }),
        );
        return { error, storedAnswerRows: yield* storedAnswers(responseId) };
      }),
    );

    expect(error._tag).toBe("RevisionConflict");
    expect(storedAnswerRows).toEqual([{ questionId: readyId, value: false }]);
  });

  test("checks FormClosed, then RevisionConflict, then the answers", async () => {
    const tags = await run(
      Effect.gen(function* () {
        const forms = yield* Forms;
        const { formId, v1 } = yield* openForm;
        const { responseId } = yield* submit(alice, formId, v1.id);
        const attempt = (expectedRevision: string) =>
          Effect.flip(edit(alice, responseId, expectedRevision, { [nameId]: 42 })).pipe(
            Effect.map((e) => e._tag),
          );

        yield* forms.updateSettings(admin, formId, { availability: "closed" });
        const closed = yield* attempt("7");
        yield* forms.updateSettings(admin, formId, { availability: "open" });
        const conflict = yield* attempt("7");
        const invalidAnswers = yield* attempt("1");
        return [closed, conflict, invalidAnswers];
      }),
    );

    expect(tags).toEqual(["FormClosed", "RevisionConflict", "ValidationFailed"]);
  });

  test("another respondent's response, another tenant's and an unknown one give NotFound", async () => {
    const { tags, storedAnswerRows } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm;
        const { responseId } = yield* submit(alice, formId, v1.id);
        const attempt = (actor: Actor, id: string) =>
          Effect.flip(edit(actor, id, "1", { [readyId]: false })).pipe(Effect.map((e) => e._tag));
        return {
          tags: [
            yield* attempt(respondent("bob"), responseId),
            yield* attempt(outsider("alice"), responseId),
            yield* attempt(alice, crypto.randomUUID()),
          ],
          storedAnswerRows: yield* storedAnswers(responseId),
        };
      }),
    );

    expect(tags).toEqual(["NotFound", "NotFound", "NotFound"]);
    expect(storedAnswerRows).toEqual([{ questionId: readyId, value: true }]);
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

  test("after an edit returns the same response with the current revision, without comparing bodies", async () => {
    const { original, replayed, storedAnswerRows } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm;
        const key = crypto.randomUUID();
        const original = yield* submitWithKey(alice, formId, v1.id, key);
        yield* edit(alice, original.responseId, original.revision, { [readyId]: false });
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
    expect(storedAnswerRows).toEqual([{ questionId: readyId, value: false }]);
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

  test("gives NotFound on reading or editing its respondent's response to another form", async () => {
    const { tags, own, responseId } = await run(
      Effect.gen(function* () {
        const a = yield* openForm;
        const b = yield* openForm;
        const { responseId, revision } = yield* submit(alice, b.formId, b.v1.id);
        const boundToA = respondent("alice", { formId: a.formId });
        return {
          responseId,
          tags: [
            (yield* Effect.flip(read(boundToA, responseId)))._tag,
            (yield* Effect.flip(edit(boundToA, responseId, revision, answers)))._tag,
          ],
          own: (yield* read(respondent("alice", { formId: b.formId }), responseId)).response.id,
        };
      }),
    );

    expect(tags).toEqual(["NotFound", "NotFound"]);
    expect(own).toBe(responseId);
  });
});

describe("an anonymous grant", () => {
  const refs = [{ namespace: "project", refId: "apollo" }];
  const grant = (formId: string, tenant = acme) => Actor.Anonymous({ tenant, formId, refs });

  test("submits to its open, unlimited form with no respondent id and the grant's refs", async () => {
    const { submitted, stored, storedRefRows } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm;
        const submitted = yield* submit(grant(formId), formId, v1.id);
        return {
          submitted,
          stored: yield* storedResponse(submitted.responseId),
          storedRefRows: yield* storedRefs(submitted.responseId),
        };
      }),
    );

    expect(submitted).toEqual({ responseId: expect.any(String), revision: "1" });
    expect(stored?.respondentId).toBeNull();
    expect(storedRefRows).toEqual(refs);
  });

  test("a replay returns the original response and inserts nothing", async () => {
    const { original, replayed, other, count } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm;
        const idempotencyKey = crypto.randomUUID();
        const send = Submission.use((submission) =>
          submission.submit(grant(formId), formId, { versionId: v1.id, answers, idempotencyKey }),
        );
        const original = yield* send;
        const replayed = yield* send;
        const other = yield* submit(grant(formId), formId, v1.id);
        return { original, replayed, other, count: yield* responseCount(formId) };
      }),
    );

    expect(replayed).toEqual(original);
    expect(other.responseId).not.toBe(original.responseId);
    expect(count).toBe(2);
  });

  test("loads a limited form as anonymous, and submitting to it gives identityRequired", async () => {
    const { loaded, refused, count } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm;
        yield* Forms.use((forms) =>
          forms.updateSettings(admin, formId, { responseLimit: "one_per_respondent" }),
        );
        return {
          loaded: yield* Submission.use((submission) => submission.load(grant(formId), formId)),
          refused: yield* Effect.flip(submit(grant(formId), formId, v1.id)),
          count: yield* responseCount(formId),
        };
      }),
    );

    expect(loaded).toMatchObject({
      responseLimit: "one_per_respondent",
      respondent: "anonymous",
      myResponseId: null,
    });
    expect(refused).toMatchObject({ _tag: "Unauthenticated", reason: "identityRequired" });
    expect(count).toBe(0);
  });

  test("gives NotFound on another form's load and submit, and on its form in another tenant", async () => {
    const { tags, count } = await run(
      Effect.gen(function* () {
        const submission = yield* Submission;
        const a = yield* openForm;
        const b = yield* openForm;
        const otherTenant = grant(b.formId, TenantId.make("globex"));
        return {
          tags: [
            (yield* Effect.flip(submission.load(grant(a.formId), b.formId)))._tag,
            (yield* Effect.flip(submit(grant(a.formId), b.formId, b.v1.id)))._tag,
            (yield* Effect.flip(submission.load(otherTenant, b.formId)))._tag,
            (yield* Effect.flip(submit(otherTenant, b.formId, b.v1.id)))._tag,
          ],
          count: yield* responseCount(b.formId),
        };
      }),
    );

    expect(tags).toEqual(["NotFound", "NotFound", "NotFound", "NotFound"]);
    expect(count).toBe(0);
  });

  test("gives identityRequired on reading or editing a response, and changes nothing", async () => {
    const { refusals, storedValues } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm;
        const { responseId } = yield* submit(grant(formId), formId, v1.id);
        return {
          refusals: [
            yield* Effect.flip(read(grant(formId), responseId)),
            yield* Effect.flip(edit(grant(formId), responseId, "1", { [readyId]: false })),
          ],
          storedValues: (yield* storedAnswers(responseId)).map(({ value }) => value),
        };
      }),
    );

    expect(refusals).toEqual([
      expect.objectContaining({ _tag: "Unauthenticated", reason: "identityRequired" }),
      expect.objectContaining({ _tag: "Unauthenticated", reason: "identityRequired" }),
    ]);
    expect(storedValues).toEqual([true]);
  });
});
