import { createFormModuleHandler } from "@fb/http-api/web";
import { Database } from "@fb/server/database";
import { DatabaseTest } from "@fb/server/testing";
import { Context, Effect, Layer, ManagedRuntime } from "effect";
import { SqlClient } from "effect/sql";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { seed } from "../seed/seed.ts";
import { devJwt } from "../server/dev-users.ts";
import { demoProjects, resolveProjectForm } from "../server/projects.ts";
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

test("the seed publishes one form in each dev tenant through the API", async () => {
  for (const admin of ["acme-admin", "globex-admin"] as const) {
    const { data } = await clientFor(admin, fetch).GET("/forms");

    expect(data?.forms).toEqual([
      expect.objectContaining({
        currentVersion: expect.objectContaining({ number: 1, publishedBy: admin }),
        hasDraft: false,
      }),
    ]);
  }
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
