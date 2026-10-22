import {
  Analytics,
  Drafts,
  FormModuleLive,
  Forms,
  Publication,
  Responses,
  Submission,
} from "@fb/server";
import { Actor, TenantId } from "@fb/server/actor";
import type { Database } from "@fb/server/database";
import { Effect, Layer, Option } from "effect";
import type { SqlClient } from "effect/sql";
import { describe, expect, test } from "vite-plus/test";

type Services = Database | SqlClient.SqlClient;

const acme = TenantId.make("acme");

const admin = Actor.Identified({
  subject: "acme-admin",
  tenant: acme,
  capabilities: ["forms:manage", "responses:read", "responses:delete"],
  formId: Option.none(),
  refs: [],
});

const respondent = (subject: string) =>
  Actor.Identified({ subject, tenant: acme, capabilities: [], formId: Option.none(), refs: [] });

const globexAdmin = Actor.Identified({
  ...admin,
  subject: "globex-admin",
  tenant: TenantId.make("globex"),
});

const readyId = "0192f5a0-7c3e-7b1a-9d2e-0000000000a1";
const colourId = "0192f5a0-7c3e-7b1a-9d2e-0000000000a2";
const toppingsId = "0192f5a0-7c3e-7b1a-9d2e-0000000000a3";
const scoreId = "0192f5a0-7c3e-7b1a-9d2e-0000000000a4";
const commentId = "0192f5a0-7c3e-7b1a-9d2e-0000000000a5";

const ready = { id: readyId, type: "boolean", label: "Ready?", required: true, config: {} };
const colour = (...options: ReadonlyArray<string>) => ({
  id: colourId,
  type: "single_choice",
  label: "Colour",
  required: false,
  config: {
    display: "radio",
    options: options.map((value) => ({ value, label: value.toUpperCase() })),
  },
});
const toppings = {
  id: toppingsId,
  type: "multiple_choice",
  label: "Toppings",
  required: false,
  config: {
    options: [
      { value: "cheese", label: "Cheese" },
      { value: "olives", label: "Olives" },
    ],
  },
};
const score = (max: number) => ({
  id: scoreId,
  type: "number",
  label: "Score",
  required: true,
  config: { integer: true, min: 1, max },
});
const comment = {
  id: commentId,
  type: "text",
  label: "Comment",
  required: false,
  config: { display: "single_line" },
};

const definition = (questions: ReadonlyArray<unknown>) => ({
  format: 1,
  title: "Survey",
  questions,
});

const v1Definition = definition([ready, colour("red", "green"), toppings, score(10), comment]);
const v2Definition = definition([ready, colour("red", "green", "blue"), toppings, score(5)]);

const analytics = (formId: string, actor: Actor = admin) =>
  Analytics.use((analytics) => analytics.form(actor, formId));

const createForm = (owner: Actor = admin) =>
  Effect.gen(function* () {
    const { form, draft } = yield* Forms.use((forms) => forms.create(owner, v1Definition));
    return { formId: form.id, revision: draft.revision };
  });

/** An open, unlimited form in `acme` with `first` published as version 1. */
const openForm = (owner: Actor = admin, first: unknown = v1Definition) =>
  Effect.gen(function* () {
    const forms = yield* Forms;
    const { form, draft } = yield* forms.create(owner, first);
    const { version } = yield* Publication.use((publication) =>
      publication.publish(owner, form.id, draft.revision),
    );
    yield* forms.updateSettings(owner, form.id, { availability: "open" });
    return { formId: form.id, v1: version };
  });

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

const submit = (actor: Actor, formId: string, versionId: string, answers: unknown) =>
  Submission.use((submission) =>
    submission.submit(actor, formId, { versionId, answers, idempotencyKey: crypto.randomUUID() }),
  );

export const describeAnalytics = (database: Layer.Layer<Services, unknown>) => {
  const run = <A, E>(
    effect: Effect.Effect<
      A,
      E,
      Forms | Drafts | Publication | Submission | Responses | Analytics | Services
    >,
  ) =>
    Effect.runPromise(
      effect.pipe(Effect.provide(FormModuleLive.pipe(Layer.provideMerge(database)))),
    );

  /**
   * Version 1 has three responses (one edited) and every view; version 2 drops the comment, offers a third
   * colour and narrows the score's range, and has two responses.
   */
  const multiVersionForm = Effect.gen(function* () {
    const { formId, v1 } = yield* openForm();
    const alice = respondent("alice");
    const { responseId } = yield* submit(alice, formId, v1.id, {
      [readyId]: true,
      [colourId]: "red",
      [toppingsId]: ["cheese", "olives"],
      [scoreId]: 2,
      [commentId]: "Lovely",
    });
    yield* Submission.use((submission) =>
      submission.edit(alice, responseId, {
        expectedRevision: "1",
        answers: {
          [readyId]: true,
          [colourId]: "red",
          [toppingsId]: ["cheese", "olives"],
          [scoreId]: 3,
          [commentId]: "Lovely",
        },
      }),
    );
    yield* submit(respondent("bob"), formId, v1.id, {
      [readyId]: false,
      [colourId]: "green",
      [toppingsId]: ["cheese"],
      [scoreId]: 4,
    });
    yield* submit(respondent("carol"), formId, v1.id, { [readyId]: true, [scoreId]: 9 });
    const v2 = yield* publish(formId, v2Definition);
    yield* submit(respondent("dave"), formId, v2.id, {
      [readyId]: true,
      [colourId]: "blue",
      [scoreId]: 5,
    });
    yield* submit(respondent("erin"), formId, v2.id, {
      [readyId]: true,
      [toppingsId]: ["olives"],
      [scoreId]: 1,
    });
    return { formId, v1, v2 };
  });

  describe("form analytics", () => {
    test("a never-published form gives empty analytics", async () => {
      const { formId, result } = await run(
        Effect.gen(function* () {
          const { formId } = yield* createForm();
          return { formId, result: yield* analytics(formId) };
        }),
      );

      expect(result).toEqual({ formId, totalResponses: 0, versions: [], questions: [] });
    });

    test("counts every version's responses, combined per question and by version, with edits counted by their latest answers", async () => {
      const { result, formId, v1, v2 } = await run(
        Effect.gen(function* () {
          const form = yield* multiVersionForm;
          // Another form's responses never count.
          const other = yield* openForm();
          yield* submit(respondent("alice"), other.formId, other.v1.id, {
            [readyId]: false,
            [scoreId]: 7,
          });
          return { ...form, result: yield* analytics(form.formId) };
        }),
      );

      expect(result.formId).toBe(formId);
      expect(result.totalResponses).toBe(5);
      expect(result.versions).toEqual([
        { versionId: v1.id, number: 1, publishedAt: v1.publishedAt, responses: 3 },
        { versionId: v2.id, number: 2, publishedAt: v2.publishedAt, responses: 2 },
      ]);
      expect(result.questions.map((q) => [q.questionId, q.inCurrentVersion])).toEqual([
        [readyId, true],
        [colourId, true],
        [toppingsId, true],
        [scoreId, true],
        [commentId, false],
      ]);

      const [readyView, colourView, toppingsView, scoreView, commentView] = result.questions;
      expect(readyView!.combined).toEqual({
        responses: 5,
        answered: 5,
        skipped: 0,
        absentResponses: 0,
        summary: { type: "boolean", trueCount: 4, falseCount: 1 },
      });
      expect(readyView!.byVersion.map((v) => v.present && v.summary)).toEqual([
        { type: "boolean", trueCount: 2, falseCount: 1 },
        { type: "boolean", trueCount: 2, falseCount: 0 },
      ]);

      expect(colourView!.combined).toEqual({
        responses: 5,
        answered: 3,
        skipped: 2,
        absentResponses: 0,
        summary: {
          type: "single_choice",
          options: [
            { value: "red", label: "RED", otherLabels: [], count: 1, base: 3, offeredIn: [1, 2] },
            {
              value: "green",
              label: "GREEN",
              otherLabels: [],
              count: 1,
              base: 3,
              offeredIn: [1, 2],
            },
            { value: "blue", label: "BLUE", otherLabels: [], count: 1, base: 1, offeredIn: [2] },
          ],
        },
      });

      expect(toppingsView!.combined.summary).toEqual({
        type: "multiple_choice",
        options: [
          {
            value: "cheese",
            label: "Cheese",
            otherLabels: [],
            count: 2,
            base: 3,
            offeredIn: [1, 2],
          },
          {
            value: "olives",
            label: "Olives",
            otherLabels: [],
            count: 2,
            base: 3,
            offeredIn: [1, 2],
          },
        ],
      });
      expect(toppingsView!.byVersion).toMatchObject([
        { answered: 2, skipped: 1, constraints: { minSelected: null, maxSelected: null } },
        { answered: 1, skipped: 1 },
      ]);

      expect(scoreView!.combined.summary).toEqual({
        type: "number",
        count: 5,
        min: 1,
        max: 9,
        mean: expect.closeTo(4.4, 10),
        median: 4,
      });
      expect(scoreView!.byVersion).toEqual([
        {
          version: 1,
          present: true,
          responses: 3,
          answered: 3,
          skipped: 0,
          summary: {
            type: "number",
            count: 3,
            min: 3,
            max: 9,
            mean: expect.closeTo(16 / 3, 10),
            median: 4,
          },
          constraints: { type: "number", integer: true, min: 1, max: 10 },
        },
        {
          version: 2,
          present: true,
          responses: 2,
          answered: 2,
          skipped: 0,
          summary: { type: "number", count: 2, min: 1, max: 5, mean: 3, median: 3 },
          constraints: { type: "number", integer: true, min: 1, max: 5 },
        },
      ]);

      expect(commentView!.combined).toEqual({
        responses: 3,
        answered: 1,
        skipped: 2,
        absentResponses: 2,
        summary: { type: "text" },
      });
      expect(commentView!.byVersion[1]).toEqual({ version: 2, present: false });
    });

    test("an NPS display reports promoters, passives, detractors and the score, and only for versions that use it", async () => {
      const recommendId = "0192f5a0-7c3e-7b1a-9d2e-0000000000b1";
      const starsId = "0192f5a0-7c3e-7b1a-9d2e-0000000000b2";
      const recommend = (display: "nps" | "scale") => ({
        id: recommendId,
        type: "number",
        label: "Recommend?",
        required: true,
        config:
          display === "nps"
            ? {
                integer: true,
                min: 0,
                max: 10,
                display,
                minLabel: "Not likely",
                maxLabel: "Very likely",
              }
            : { integer: true, min: 0, max: 10, display },
      });
      const stars = {
        id: starsId,
        type: "number",
        label: "Stars",
        required: false,
        config: { integer: true, min: 1, max: 5, display: "rating" },
      };
      const { result } = await run(
        Effect.gen(function* () {
          const { formId, v1 } = yield* openForm(admin, definition([recommend("nps"), stars]));
          yield* submit(respondent("alice"), formId, v1.id, {
            [recommendId]: 10,
            [starsId]: 5,
          });
          yield* submit(respondent("bob"), formId, v1.id, { [recommendId]: 9, [starsId]: 1 });
          yield* submit(respondent("carol"), formId, v1.id, { [recommendId]: 0 });
          yield* submit(respondent("dave"), formId, v1.id, { [recommendId]: 7 });
          const v2 = yield* publish(formId, definition([recommend("scale"), stars]));
          yield* submit(respondent("erin"), formId, v2.id, { [recommendId]: 0 });
          return { result: yield* analytics(formId) };
        }),
      );

      const recommendView = result.questions.find((q) => q.questionId === recommendId)!;
      expect(recommendView.combined.summary).toEqual({
        type: "number",
        count: 5,
        min: 0,
        max: 10,
        mean: expect.closeTo(5.2, 5),
        median: 7,
        nps: { promoters: 2, passives: 1, detractors: 1, answered: 4, score: 25 },
      });
      expect(recommendView.byVersion).toEqual([
        {
          version: 1,
          present: true,
          responses: 4,
          answered: 4,
          skipped: 0,
          summary: {
            type: "number",
            count: 4,
            min: 0,
            max: 10,
            mean: expect.closeTo(6.5, 5),
            median: 8,
            nps: { promoters: 2, passives: 1, detractors: 1, answered: 4, score: 25 },
          },
          constraints: { type: "number", integer: true, min: 0, max: 10 },
        },
        {
          version: 2,
          present: true,
          responses: 1,
          answered: 1,
          skipped: 0,
          summary: { type: "number", count: 1, min: 0, max: 0, mean: 0, median: 0 },
          constraints: { type: "number", integer: true, min: 0, max: 10 },
        },
      ]);

      const starsView = result.questions.find((q) => q.questionId === starsId)!;
      expect(starsView.combined.summary).toEqual({
        type: "number",
        count: 2,
        min: 1,
        max: 5,
        mean: 3,
        median: 3,
      });
    });

    test("an analyst with only responses:read gets the analytics", async () => {
      const analyst = Actor.Identified({ ...admin, capabilities: ["responses:read"] });
      const result = await run(
        Effect.gen(function* () {
          const { formId } = yield* openForm();
          return yield* analytics(formId, analyst);
        }),
      );

      expect(result.versions).toHaveLength(1);
    });

    test("without responses:read gives Forbidden, even with forms:manage", async () => {
      const manager = Actor.Identified({ ...admin, capabilities: ["forms:manage"] });
      const error = await run(
        Effect.gen(function* () {
          const { formId } = yield* openForm();
          return yield* Effect.flip(analytics(formId, manager));
        }),
      );

      expect(error).toMatchObject({ _tag: "Forbidden", capability: "responses:read" });
    });

    test("an unknown form and another tenant's form give NotFound", async () => {
      const { unknown, otherTenant } = await run(
        Effect.gen(function* () {
          const { formId } = yield* openForm();
          return {
            unknown: yield* Effect.flip(analytics(crypto.randomUUID())),
            otherTenant: yield* Effect.flip(analytics(formId, globexAdmin)),
          };
        }),
      );

      expect(unknown._tag).toBe("NotFound");
      expect(otherTenant._tag).toBe("NotFound");
    });
  });
};
