import {
  Analytics,
  Drafts,
  type FormAnalytics,
  FormModuleLive,
  Forms,
  type ListResponses,
  Publication,
  Responses,
  Submission,
} from "@fb/server";
import { Actor, type ExternalRef, TenantId } from "@fb/server/actor";
import { DatabaseTest } from "@fb/server/testing";
import { Effect, Layer, Option } from "effect";
import { SqlClient } from "effect/sql";
import { describe, expect, test } from "vite-plus/test";

const acme = TenantId.make("acme");

const admin = Actor.Identified({
  subject: "acme-admin",
  tenant: acme,
  capabilities: ["forms:manage", "responses:read", "responses:delete"],
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
const bob = respondent("bob");

const globex = TenantId.make("globex");
const globexAdmin = Actor.Identified({ ...admin, subject: "globex-admin", tenant: globex });
const globexAlice = Actor.Identified({ ...alice, tenant: globex });

const readyId = "0192f5a0-7c3e-7b1a-9d2e-000000000002";

const definition = (title: string) => ({
  format: 1 as const,
  title,
  questions: [
    { id: readyId, type: "boolean" as const, label: "Ready?", required: true, config: {} },
  ],
});

const answers = { [readyId]: true };

const run = <A, E>(
  effect: Effect.Effect<
    A,
    E,
    | Forms
    | Drafts
    | Publication
    | Submission
    | Responses
    | Analytics
    | Layer.Success<typeof DatabaseTest>
  >,
) =>
  Effect.runPromise(
    effect.pipe(Effect.provide(FormModuleLive.pipe(Layer.provideMerge(DatabaseTest)))),
  );

/** An open, unlimited form in `acme` with one published version. */
const openForm = (owner: Actor = admin, first: unknown = definition("Survey")) =>
  Effect.gen(function* () {
    const forms = yield* Forms;
    const publication = yield* Publication;
    const { form, draft } = yield* forms.create(owner, first);
    const { version } = yield* publication.publish(owner, form.id, draft.revision);
    yield* forms.updateSettings(owner, form.id, { availability: "open" });
    return { formId: form.id, v1: version };
  });

const submit = (
  actor: Actor,
  formId: string,
  versionId: string,
  given: unknown = answers,
  idempotencyKey: string = crypto.randomUUID(),
) =>
  Submission.use((submission) =>
    submission.submit(actor, formId, { versionId, answers: given, idempotencyKey }),
  );

/** Publishes `next` as the form's next version. */
const publish = (formId: string, next: unknown) =>
  Effect.gen(function* () {
    const drafts = yield* Drafts;
    const draft = yield* drafts.save(admin, formId, {
      expectedRevision: (yield* drafts.read(admin, formId))?.revision ?? null,
      definition: next,
    });
    return (yield* Publication.use((publication) =>
      publication.publish(admin, formId, draft.revision),
    )).version;
  });

const read = (actor: Actor, responseId: string) =>
  Responses.use((responses) => responses.read(actor, responseId));

const list = (query: ListResponses, actor: Actor = admin) =>
  Responses.use((responses) => responses.list(actor, query));

const listedIds = (query: ListResponses, actor?: Actor) =>
  Effect.map(list(query, actor), (page) => page.responses.map((response) => response.id));

const deleteOne = (responseId: string, actor: Actor = admin) =>
  Responses.use((responses) => responses.delete(actor, responseId));

const erase = (respondentId: string, actor: Actor = admin) =>
  Responses.use((responses) => responses.deleteByRespondent(actor, respondentId));

const versionRead = (formId: string, versionId: string) =>
  Publication.use((publication) => publication.version(admin, formId, versionId));

const analytics = (formId: string) => Analytics.use((analytics) => analytics.form(admin, formId));

/** The form's total and the one boolean question's combined counts. */
const readyCounts = ({ totalResponses, questions }: FormAnalytics) => {
  const { responses, answered, summary } = questions[0]!.combined;
  return {
    total: totalResponses,
    responses,
    answered,
    trueCount: summary.type === "boolean" ? summary.trueCount : undefined,
  };
};

/** UUIDv7 ids order by time only across milliseconds, so newest-first needs a gap between submits. */
const tick = Effect.promise(() => new Promise((resolve) => setTimeout(resolve, 2)));

describe("list", () => {
  test("gives the tenant's responses newest first, as summaries without answers", async () => {
    const { listed, first, second, v1, formId } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm();
        const first = yield* submit(alice, formId, v1.id);
        yield* tick;
        const second = yield* submit(bob, formId, v1.id);
        const listed = yield* Responses.use((responses) => responses.list(admin, {}));
        return { listed, first, second, v1, formId };
      }),
    );

    expect(listed).toEqual({
      responses: [
        {
          id: second.responseId,
          formId,
          versionId: v1.id,
          versionNumber: 1,
          respondentId: "bob",
          submittedAt: expect.any(Date),
          editedAt: null,
          externalRefs: [],
        },
        {
          id: first.responseId,
          formId,
          versionId: v1.id,
          versionNumber: 1,
          respondentId: "alice",
          submittedAt: expect.any(Date),
          editedAt: null,
          externalRefs: [],
        },
      ],
      nextCursor: null,
    });
  });

  test("filters by form and by version", async () => {
    const { byForm, byVersion, onA1, onA2, onB } = await run(
      Effect.gen(function* () {
        const a = yield* openForm();
        const b = yield* openForm();
        const onA1 = yield* submit(alice, a.formId, a.v1.id);
        const a2 = yield* publish(a.formId, definition("Survey, revised"));
        yield* tick;
        const onA2 = yield* submit(alice, a.formId, a2.id);
        const onB = yield* submit(alice, b.formId, b.v1.id);
        return {
          byForm: yield* listedIds({ formId: a.formId }),
          byVersion: yield* listedIds({ versionId: a.v1.id }),
          onA1: onA1.responseId,
          onA2: onA2.responseId,
          onB: onB.responseId,
        };
      }),
    );

    expect(byForm).toEqual([onA2, onA1]);
    expect(byVersion).toEqual([onA1]);
    expect(byForm).not.toContain(onB);
  });

  test("by respondent with no form, lists their responses across every form in the tenant and none from another tenant", async () => {
    const { listed, expected, globexResponse } = await run(
      Effect.gen(function* () {
        const a = yield* openForm();
        const b = yield* openForm();
        const g = yield* openForm(globexAdmin);
        const onA = yield* submit(alice, a.formId, a.v1.id);
        yield* tick;
        yield* submit(bob, a.formId, a.v1.id);
        const onB = yield* submit(alice, b.formId, b.v1.id);
        const globexResponse = yield* submit(globexAlice, g.formId, g.v1.id);
        return {
          listed: yield* listedIds({ respondentId: "alice" }),
          expected: [onB.responseId, onA.responseId],
          globexResponse: globexResponse.responseId,
        };
      }),
    );

    expect(listed).toEqual(expected);
    expect(listed).not.toContain(globexResponse);
  });

  test("by reference, finds a response submitted under that refs claim", async () => {
    const apollo = { namespace: "project", refId: "apollo" };
    const { listed, referenced } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm();
        const referenced = yield* submit(
          respondent("alice", {
            formId,
            refs: [{ namespace: "crm.account", refId: "a-1" }, apollo],
          }),
          formId,
          v1.id,
        );
        yield* submit(
          respondent("bob", { formId, refs: [{ ...apollo, refId: "gemini" }] }),
          formId,
          v1.id,
        );
        yield* submit(alice, formId, v1.id);
        return { listed: yield* list({ ref: apollo }), referenced: referenced.responseId };
      }),
    );

    expect(listed.responses).toEqual([
      expect.objectContaining({
        id: referenced,
        externalRefs: [{ namespace: "crm.account", refId: "a-1" }, apollo],
      }),
    ]);
  });

  test("pages hold 50 responses by default, and the last page has no cursor", async () => {
    const { first, second } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm();
        for (let i = 0; i < 51; i++) yield* submit(alice, formId, v1.id);
        const first = yield* list({});
        const second = yield* list({ cursor: first.nextCursor! });
        return { first, second };
      }),
    );

    expect(first.responses).toHaveLength(50);
    expect(first.nextCursor).toBe(first.responses.at(-1)!.id);
    expect(second.responses).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
  });

  test("pagination is stable across edits", async () => {
    const { pages, submitted } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm();
        const submitted: Array<string> = [];
        for (let i = 0; i < 5; i++) {
          submitted.unshift((yield* submit(alice, formId, v1.id)).responseId);
          yield* tick;
        }
        const first = yield* list({ limit: 2 });
        // Edit one response already shown and one still to come.
        for (const responseId of [submitted[1]!, submitted[3]!]) {
          yield* Submission.use((submission) =>
            submission.edit(alice, responseId, {
              expectedRevision: "1",
              answers: { [readyId]: false },
            }),
          );
        }
        const second = yield* list({ limit: 2, cursor: first.nextCursor! });
        const third = yield* list({ limit: 2, cursor: second.nextCursor! });
        return { pages: [first, second, third], submitted };
      }),
    );

    expect(pages.map((page) => page.responses.map((response) => response.id))).toEqual([
      submitted.slice(0, 2),
      submitted.slice(2, 4),
      submitted.slice(4),
    ]);
    expect(pages[1]!.responses[1]!.editedAt).toEqual(expect.any(Date));
    expect(pages[2]!.nextCursor).toBeNull();
  });
});

describe("delete", () => {
  test("deleting one response removes only that response", async () => {
    const { readAgain, deleteAgain, listed, kept } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm();
        const { responseId } = yield* submit(alice, formId, v1.id);
        const kept = (yield* submit(alice, formId, v1.id)).responseId;
        yield* deleteOne(responseId);
        return {
          readAgain: yield* Effect.flip(read(admin, responseId)),
          deleteAgain: yield* Effect.flip(deleteOne(responseId)),
          listed: yield* listedIds({ formId }),
          kept,
        };
      }),
    );

    expect(readAgain._tag).toBe("NotFound");
    expect(deleteAgain._tag).toBe("NotFound");
    expect(listed).toEqual([kept]);
  });

  test("by respondent covers the whole tenant, and gives { deleted: 0 } when there's nothing to delete", async () => {
    const { erased, again, left, others, versions, before, after } = await run(
      Effect.gen(function* () {
        const a = yield* openForm();
        const b = yield* openForm();
        const g = yield* openForm(globexAdmin);
        yield* submit(alice, a.formId, a.v1.id);
        yield* submit(alice, a.formId, a.v1.id);
        yield* submit(alice, b.formId, b.v1.id);
        const bobs = yield* submit(bob, a.formId, a.v1.id);
        const globexResponse = yield* submit(globexAlice, g.formId, g.v1.id);
        const before = [yield* analytics(a.formId), yield* analytics(b.formId)];
        const erased = yield* erase("alice");
        return {
          before,
          after: [yield* analytics(a.formId), yield* analytics(b.formId)],
          erased,
          again: yield* erase("alice"),
          left: yield* listedIds({ respondentId: "alice" }),
          others: {
            bob: yield* listedIds({ respondentId: "bob" }),
            expectedBob: [bobs.responseId],
            globex: yield* listedIds({ respondentId: "alice" }, globexAdmin),
            expectedGlobex: [globexResponse.responseId],
          },
          versions: [yield* versionRead(a.formId, a.v1.id), yield* versionRead(b.formId, b.v1.id)],
        };
      }),
    );

    expect(erased).toEqual({ deleted: 3 });
    expect(again).toEqual({ deleted: 0 });
    expect(left).toEqual([]);
    expect(others.bob).toEqual(others.expectedBob);
    expect(others.globex).toEqual(others.expectedGlobex);
    expect(versions.map((version) => version.definition)).toEqual([
      definition("Survey"),
      definition("Survey"),
    ]);
    // Alice gave two of form a's three responses and form b's only one.
    expect(before.map(readyCounts)).toEqual([
      { total: 3, responses: 3, answered: 3, trueCount: 3 },
      { total: 1, responses: 1, answered: 1, trueCount: 1 },
    ]);
    expect(after.map(readyCounts)).toEqual([
      { total: 1, responses: 1, answered: 1, trueCount: 1 },
      { total: 0, responses: 0, answered: 0, trueCount: 0 },
    ]);
  });

  test("another tenant's admin gets NotFound for one response and deletes nothing by respondent", async () => {
    const { deleteOneError, erased, listed, responseId } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm();
        const { responseId } = yield* submit(alice, formId, v1.id);
        return {
          deleteOneError: yield* Effect.flip(deleteOne(responseId, globexAdmin)),
          erased: yield* erase("alice", globexAdmin),
          listed: yield* listedIds({ formId }),
          responseId,
        };
      }),
    );

    expect(deleteOneError._tag).toBe("NotFound");
    expect(erased).toEqual({ deleted: 0 });
    expect(listed).toEqual([responseId]);
  });

  test("after the last response of a version is deleted, that version and its question keys still read", async () => {
    const { version, questionKeys, resubmitted, emptied } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm();
        const { responseId } = yield* submit(alice, formId, v1.id);
        yield* deleteOne(responseId);
        const emptied = yield* analytics(formId);
        const questionKeys = yield* SqlClient.SqlClient.use(
          (sql) => sql<{ questionId: string }>`
            SELECT question_id AS "questionId" FROM form_management.form_version_questions
            WHERE version_id = ${v1.id}
          `,
        );
        return {
          emptied,
          version: yield* versionRead(formId, v1.id),
          questionKeys,
          // An answer row needs its question key in the version.
          resubmitted: yield* submit(bob, formId, v1.id),
        };
      }),
    );

    expect(version.definition).toEqual(definition("Survey"));
    expect(questionKeys).toEqual([{ questionId: readyId }]);
    expect(resubmitted.responseId).toEqual(expect.any(String));
    expect(emptied.totalResponses).toBe(0);
    expect(emptied.versions).toEqual([
      { versionId: version.id, number: 1, publishedAt: version.publishedAt, responses: 0 },
    ]);
    expect(emptied.questions.map((q) => q.byVersion)).toEqual([
      [
        {
          version: 1,
          present: true,
          responses: 0,
          shown: 0,
          answered: 0,
          skipped: 0,
          notShown: 0,
          summary: { type: "boolean", trueCount: 0, falseCount: 0 },
          constraints: null,
        },
      ],
    ]);
  });

  test("after erasure, the same idempotency key creates a new response", async () => {
    const { first, second, listed } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm();
        const key = crypto.randomUUID();
        const first = yield* submit(alice, formId, v1.id, answers, key);
        yield* erase("alice");
        const second = yield* submit(alice, formId, v1.id, answers, key);
        return { first, second, listed: yield* listedIds({ formId }) };
      }),
    );

    expect(second.responseId).not.toBe(first.responseId);
    expect(listed).toEqual([second.responseId]);
  });

  test("after erasure, the same respondent can submit again to a one-per-respondent form", async () => {
    const { blocked, resubmitted } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm();
        yield* Forms.use((forms) =>
          forms.updateSettings(admin, formId, { responseLimit: "one_per_respondent" }),
        );
        yield* submit(alice, formId, v1.id);
        const blocked = yield* Effect.flip(submit(alice, formId, v1.id));
        yield* erase("alice");
        return { blocked, resubmitted: yield* submit(alice, formId, v1.id) };
      }),
    );

    expect(blocked._tag).toBe("AlreadyResponded");
    expect(resubmitted.responseId).toEqual(expect.any(String));
  });
});

describe("authorization", () => {
  test("without responses:delete, both deletes give Forbidden", async () => {
    const reader = Actor.Identified({ ...admin, capabilities: ["responses:read"] });
    const { deleteOneError, eraseError } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm();
        const { responseId } = yield* submit(alice, formId, v1.id);
        return {
          deleteOneError: yield* Effect.flip(deleteOne(responseId, reader)),
          eraseError: yield* Effect.flip(erase("alice", reader)),
        };
      }),
    );

    expect(deleteOneError).toMatchObject({ _tag: "Forbidden", capability: "responses:delete" });
    expect(eraseError).toMatchObject({ _tag: "Forbidden", capability: "responses:delete" });
  });

  test("without responses:read, listing and reading give Forbidden", async () => {
    const manager = Actor.Identified({ ...admin, capabilities: ["forms:manage"] });
    const { listed, readOne } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm();
        const { responseId } = yield* submit(alice, formId, v1.id);
        return {
          listed: yield* Effect.flip(list({}, manager)),
          readOne: yield* Effect.flip(read(manager, responseId)),
        };
      }),
    );

    expect(listed).toMatchObject({ _tag: "Forbidden", capability: "responses:read" });
    expect(readOne).toMatchObject({ _tag: "Forbidden", capability: "responses:read" });
  });

  test("another tenant's admin gets NotFound on a read and an empty list", async () => {
    const { readOne, listed } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm();
        const { responseId } = yield* submit(alice, formId, v1.id);
        return {
          readOne: yield* Effect.flip(read(globexAdmin, responseId)),
          listed: yield* list({ formId }, globexAdmin),
        };
      }),
    );

    expect(readOne._tag).toBe("NotFound");
    expect(listed).toEqual({ responses: [], nextCursor: null });
  });
});

describe("read", () => {
  const colourId = "0192f5a0-7c3e-7b1a-9d2e-000000000003";
  const colour = (green: string) => ({
    id: colourId,
    type: "single_choice" as const,
    label: "Colour",
    required: true,
    config: {
      display: "radio" as const,
      options: [
        { value: "red", label: "Red" },
        { value: "green", label: green },
      ],
    },
  });
  const v1Definition = {
    ...definition("Survey"),
    questions: [...definition("Survey").questions, colour("Green")],
  };

  test("a v1 response after v2 dropped a question and relabelled an option gives v1's snapshots and the raw answers", async () => {
    const { detail, v1, formId, responseId } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm(admin, v1Definition);
        const { responseId } = yield* submit(alice, formId, v1.id, {
          [readyId]: true,
          [colourId]: "green",
        });
        yield* publish(formId, { ...definition("Survey, revised"), questions: [colour("Lime")] });
        return { detail: yield* read(admin, responseId), v1, formId, responseId };
      }),
    );

    expect(detail).toEqual({
      response: {
        id: responseId,
        formId,
        versionId: v1.id,
        versionNumber: 1,
        respondentId: "alice",
        submittedAt: expect.any(Date),
        editedAt: null,
        externalRefs: [],
        answers: { [readyId]: true, [colourId]: "green" },
      },
      path: [readyId, colourId],
      version: { id: v1.id, number: 1, definition: v1Definition },
    });
  });
});
