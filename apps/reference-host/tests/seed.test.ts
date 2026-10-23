import { createFormModuleHandler } from "@fb/http-api/web";
import { Database } from "@fb/server/database";
import { DatabaseTest } from "@fb/server/testing";
import { Context, Effect, Layer, ManagedRuntime } from "effect";
import { SqlClient } from "effect/sql";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { seed } from "../seed/seed.ts";
import { devJwt } from "../server/dev-users.ts";
import { demoProjects, pagedDemoProject, resolveProjectForm } from "../server/projects.ts";
import { clientFor } from "./api.ts";

// The module's handler on a PGlite database the test can also query, checking tokens as the seed's handler does.
const database = ManagedRuntime.make(DatabaseTest);
let handler: ReturnType<typeof createFormModuleHandler>;
const fetch = (request: Request) => handler.fetch(request);

beforeAll(async () => {
  const shared = Layer.succeed(Database, Context.get(await database.context(), Database));
  handler = createFormModuleHandler({ database: shared, jwt: devJwt });
  await seed(fetch);
});

afterAll(async () => {
  await handler.dispose();
  await database.dispose();
});

const query = <A>(statement: (sql: SqlClient.SqlClient) => Effect.Effect<A, unknown>) =>
  database.runPromise(SqlClient.SqlClient.use(statement).pipe(Effect.orDie));

test.each([
  [
    "acme-admin",
    [
      ["Onboarding survey", 4],
      ["Trip planner", 1],
      ["Customer feedback", 1],
    ],
  ],
  ["globex-admin", [["Event registration", 1]]],
] as const)("the seed publishes %s's forms through the API", async (admin, forms) => {
  const { data } = await clientFor(admin, fetch).GET("/forms");

  expect(data?.forms).toEqual(
    forms.map(([title, number]) =>
      expect.objectContaining({
        title,
        currentVersion: expect.objectContaining({ number, publishedBy: admin }),
        hasDraft: false,
      }),
    ),
  );
});

test("the acme onboarding survey's versions exercise every cross-version case", async () => {
  const admin = clientFor("acme-admin", fetch);
  const forms = (await admin.GET("/forms")).data?.forms ?? [];
  const formId = forms.find((form) => form.title === "Onboarding survey")?.id ?? "";

  const { data } = await admin.GET("/forms/{formId}/analytics", {
    params: { path: { formId } },
  });

  expect(data?.versions.map(({ number, responses }) => [number, responses])).toEqual([
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 3],
  ]);
  const questions = data?.questions ?? [];
  const byLabel = (label: string) => questions.filter((question) => question.label === label);
  const presentIn = (question: (typeof questions)[number] | undefined) =>
    question?.byVersion.filter((entry) => entry.present).map((entry) => entry.version);

  const [dropped] = byLabel("How did you find us?");
  expect(dropped?.inCurrentVersion).toBe(false);
  expect(presentIn(dropped)).toEqual([1]);

  const [ease] = byLabel("How easy was the setup?");
  const options =
    ease?.combined.summary.type === "single_choice" ? ease.combined.summary.options : [];
  expect(options).toContainEqual(
    expect.objectContaining({ value: "very_easy", offeredIn: [3, 4] }),
  );
  expect(options).toContainEqual(
    expect.objectContaining({
      value: "manageable",
      label: "Manageable",
      otherLabels: [{ label: "OK", versions: [1, 2] }],
    }),
  );

  const [hours] = byLabel("How many hours did the setup take?");
  expect(
    hours?.byVersion.map((entry) =>
      entry.present && entry.constraints?.type === "number" ? entry.constraints.max : null,
    ),
  ).toEqual([8, 8, 24, 24]);

  const team = byLabel("How big is your team?");
  expect(team.map(({ type, inCurrentVersion }) => [type, inCurrentVersion])).toEqual([
    ["text", true],
    ["text", false],
  ]);
  expect(team.map(presentIn)).toEqual([[4], [1, 2, 3]]);

  const respondents = await query(
    (sql) => sql`
      SELECT DISTINCT respondent_id AS "respondentId" FROM form_management.responses
      WHERE form_id = ${formId} ORDER BY respondent_id NULLS LAST
    `,
  );
  expect(respondents).toEqual([
    { respondentId: "alice" },
    { respondentId: "bob" },
    { respondentId: null },
  ]);
});

test("the trip planner is one paged form with show conditions, a jump and every new question type", async () => {
  const resolved = await resolveProjectForm(fetch, "acme", pagedDemoProject);
  expect(resolved).toEqual({
    kind: "one",
    form: { id: expect.any(String), title: "Trip planner" },
  });
  const formId = resolved.kind === "one" ? resolved.form.id : "";
  const admin = clientFor("acme-admin", fetch);

  const { data: draft } = await admin.GET("/forms/{formId}/draft", {
    params: { path: { formId } },
  });
  const { data: versions } = await admin.GET("/forms/{formId}/versions", {
    params: { path: { formId } },
  });
  const version = versions?.versions[0];
  expect(version).toBeDefined();
  expect(draft).toEqual({ draft: null });
  const { data: published } = await admin.GET("/forms/{formId}/versions/{versionId}", {
    params: { path: { formId, versionId: version?.id ?? "" } },
  });
  const definition = published?.definition;
  if (definition?.format !== 2) throw new Error("the trip planner is format 2");
  expect(definition.pages.map((page) => page.title)).toEqual([
    "Your trip",
    "Your flights",
    "Your stay",
    "How we did",
  ]);
  expect(definition.pages.flatMap((page) => page.jumps)).toHaveLength(1);
  const questions = definition.pages.flatMap((page) => page.questions);
  expect(questions.filter((question) => question.showCondition !== undefined)).toHaveLength(2);
  const displays = questions.flatMap((question) =>
    question.type === "number" ? [question.config.display] : [],
  );
  expect(displays).toEqual(["rating", "scale", "slider", "nps"]);
  expect(new Set(questions.map((question) => question.type))).toEqual(
    new Set([
      "phone",
      "url",
      "boolean",
      "time_of_day",
      "date_time",
      "date_range",
      "address",
      "text",
      "ranking",
      "single_choice_matrix",
      "multiple_choice_matrix",
      "number",
    ]),
  );
  expect(
    questions.some((question) => question.type === "boolean" && question.config.mustBeYes === true),
  ).toBe(true);

  // Two responses, one on each side of the jump: what each question shows is counted as not shown, not skipped.
  const { data: analytics } = await admin.GET("/forms/{formId}/analytics", {
    params: { path: { formId } },
  });
  const counts = (label: string) => {
    const combined = analytics?.questions.find((question) => question.label === label)?.combined;
    return [combined?.answered, combined?.skipped, combined?.notShown];
  };
  expect(counts("Preferred departure time")).toEqual([1, 0, 1]);
  expect(counts("Anything we should know about your flights?")).toEqual([1, 0, 1]);
  expect(counts("What should we improve?")).toEqual([1, 0, 1]);
  expect(counts("Contact phone")).toEqual([2, 0, 0]);
});

test.each([
  ["acme", "Customer feedback", "alice"],
  ["globex", "Event registration", "globex-admin"],
] as const)(
  "the %s demo project resolves to %s, with an identified and an anonymous response under its reference",
  async (tenant, title, respondent) => {
    const projectId = demoProjects[tenant];

    const resolved = await resolveProjectForm(fetch, tenant, projectId);

    expect(resolved).toEqual({ kind: "one", form: { id: expect.any(String), title } });
    const formId = resolved.kind === "one" ? resolved.form.id : "";
    const responses = await query(
      (sql) => sql`
        SELECT r.respondent_id AS "respondentId", x.namespace, x.ref_id AS "refId"
        FROM form_management.responses r
        LEFT JOIN form_management.response_external_refs x ON x.response_id = r.id
        WHERE r.form_id = ${formId}
        ORDER BY r.respondent_id NULLS LAST
      `,
    );
    expect(responses).toEqual([
      { respondentId: respondent, namespace: "project", refId: projectId },
      { respondentId: null, namespace: "project", refId: projectId },
    ]);
  },
);
