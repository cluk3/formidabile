import { Analytics, Drafts, FormModuleLive, Forms, Publication, Submission } from "@fb/server";
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
  capabilities: ["forms:manage", "responses:read"],
  formId: Option.none(),
  refs: [],
});

const respondent = (subject: string) =>
  Actor.Identified({ subject, tenant: acme, capabilities: [], formId: Option.none(), refs: [] });

const gridId = "0192f5a0-7c3e-7b1a-9d2e-0000000000b1";
const checksId = "0192f5a0-7c3e-7b1a-9d2e-0000000000b2";

const line = (value: string, label: string) => ({ value, label });

const grid = (
  rows: ReadonlyArray<readonly [string, string]>,
  columns: ReadonlyArray<readonly [string, string]>,
) => ({
  id: gridId,
  type: "single_choice_matrix" as const,
  label: "Trip",
  required: false,
  config: {
    rows: rows.map(([value, label]) => line(value, label)),
    columns: columns.map(([value, label]) => line(value, label)),
  },
});

const checks = {
  id: checksId,
  type: "multiple_choice_matrix" as const,
  label: "Kit",
  required: false,
  config: {
    rows: [line("items", "Items")],
    columns: [line("a", "A"), line("b", "B")],
  },
};

const definition = (questions: ReadonlyArray<unknown>) => ({
  format: 1 as const,
  title: "Survey",
  questions,
});

const v1 = definition([
  grid(
    [
      ["speed", "Speed"],
      ["comfort", "Comfort"],
      ["price", "Price"],
    ],
    [
      ["good", "Good"],
      ["poor", "Poor"],
    ],
  ),
]);

const v2 = definition([
  grid(
    [
      ["speed", "Pace"],
      ["noise", "Noise"],
    ],
    [
      ["good", "Good"],
      ["fair", "Fair"],
    ],
  ),
]);

const cell = (
  row: string,
  column: string,
  count: number,
  base: number,
  share: number | null,
  rowLabel: string,
  columnLabel: string,
  otherRowLabels: ReadonlyArray<{ label: string; versions: number[] }> = [],
) => ({
  row,
  column,
  count,
  base,
  share,
  rowLabel,
  columnLabel,
  otherRowLabels,
  otherColumnLabels: [],
});

export const describeMatrixAnalytics = (database: Layer.Layer<Services, unknown>) => {
  const run = <A, E>(
    effect: Effect.Effect<A, E, Forms | Drafts | Publication | Submission | Analytics | Services>,
  ) =>
    Effect.runPromise(
      effect.pipe(Effect.provide(FormModuleLive.pipe(Layer.provideMerge(database)))),
    );

  const open = (first: unknown) =>
    Effect.gen(function* () {
      const forms = yield* Forms;
      const { form, draft } = yield* forms.create(admin, first);
      const { version } = yield* Publication.use((publication) =>
        publication.publish(admin, form.id, draft.revision),
      );
      yield* forms.updateSettings(admin, form.id, { availability: "open" });
      return { formId: form.id, versionId: version.id };
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

  const submit = (subject: string, formId: string, versionId: string, answers: unknown) =>
    Submission.use((submission) =>
      submission.submit(respondent(subject), formId, {
        versionId,
        answers,
        idempotencyKey: crypto.randomUUID(),
      }),
    );

  describe("matrix analytics", () => {
    test("counts each row and column from the answered rows of versions that had both", async () => {
      const analytics = await run(
        Effect.gen(function* () {
          const { formId, versionId } = yield* open(v1);
          yield* submit("ann", formId, versionId, {
            [gridId]: { speed: "good", comfort: "poor" },
          });
          yield* submit("ben", formId, versionId, { [gridId]: { speed: "good" } });
          yield* submit("cia", formId, versionId, {});
          const next = yield* publish(formId, v2);
          yield* submit("dan", formId, next.id, { [gridId]: { speed: "fair", noise: "good" } });
          return yield* Analytics.use((service) => service.form(admin, formId));
        }),
      );

      const question = analytics.questions.find((item) => item.questionId === gridId);
      expect(question?.combined.summary.type).toBe("single_choice_matrix");
      if (question?.combined.summary.type !== "single_choice_matrix") throw new Error("summary");
      expect(question.combined.summary.cells).toEqual([
        cell("speed", "good", 2, 3, 67, "Pace", "Good", [{ label: "Speed", versions: [1] }]),
        cell("speed", "fair", 1, 1, 100, "Pace", "Fair"),
        cell("noise", "good", 1, 1, 100, "Noise", "Good"),
        cell("noise", "fair", 0, 1, 0, "Noise", "Fair"),
        cell("speed", "poor", 0, 2, 0, "Speed", "Poor"),
        cell("comfort", "good", 0, 1, 0, "Comfort", "Good"),
        cell("comfort", "poor", 1, 1, 100, "Comfort", "Poor"),
        cell("price", "good", 0, 0, null, "Price", "Good"),
        cell("price", "poor", 0, 0, null, "Price", "Poor"),
      ]);
      const first = question.byVersion.find((entry) => entry.version === 1);
      if (first?.present !== true || first.summary.type !== "single_choice_matrix")
        throw new Error("version 1");
      expect(
        first.summary.cells.map((item) => [item.row, item.column, item.count, item.base]),
      ).toEqual([
        ["speed", "good", 2, 2],
        ["speed", "poor", 0, 2],
        ["comfort", "good", 0, 1],
        ["comfort", "poor", 1, 1],
        ["price", "good", 0, 0],
        ["price", "poor", 0, 0],
      ]);
      expect(question.combined.summary).not.toHaveProperty("answers");
    });

    test("a multiple-choice row counts every selected column against the answered rows", async () => {
      const analytics = await run(
        Effect.gen(function* () {
          const { formId, versionId } = yield* open(definition([checks]));
          yield* submit("ann", formId, versionId, { [checksId]: { items: ["a", "b"] } });
          yield* submit("ben", formId, versionId, { [checksId]: { items: ["a"] } });
          return yield* Analytics.use((service) => service.form(admin, formId));
        }),
      );

      const question = analytics.questions.find((item) => item.questionId === checksId);
      if (question?.combined.summary.type !== "multiple_choice_matrix") throw new Error("summary");
      expect(question.combined.summary.cells).toEqual([
        cell("items", "a", 2, 2, 100, "Items", "A"),
        cell("items", "b", 1, 2, 50, "Items", "B"),
      ]);
      expect(question.combined).not.toHaveProperty("answers");
    });
  });
};
