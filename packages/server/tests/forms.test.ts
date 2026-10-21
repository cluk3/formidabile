import { FormModuleLive, Forms } from "@fb/server";
import { Actor, TenantId } from "@fb/server/actor";
import { DatabaseTest } from "@fb/server/testing";
import { Effect, Layer, Option } from "effect";
import { SqlClient } from "effect/sql";
import { expect, test } from "vite-plus/test";

const admin = Actor.Identified({
  subject: "acme-admin",
  tenant: TenantId.make("acme"),
  capabilities: ["forms:manage"],
  formId: Option.none(),
  refs: [],
});

const definition = (title: string) => ({ format: 1, title, questions: [] });

// Publishing arrives later; until then a published form without a draft is written directly.
const publishWithoutDraft = (formId: string, versionId: string, title: string) =>
  SqlClient.SqlClient.use(
    (sql) => sql`
      WITH version AS (
        INSERT INTO form_management.form_versions (id, form_id, number, definition, published_at, published_by)
        VALUES (${versionId}, ${formId}, 1, ${JSON.stringify(definition(title))}::jsonb,
                '2026-10-21T00:00:00Z', 'acme-admin')
      ), draft AS (
        DELETE FROM form_management.drafts WHERE form_id = ${formId}
      )
      UPDATE form_management.forms SET current_version_id = ${versionId} WHERE id = ${formId}
    `,
  );

test("a published form without a draft shows its current version's title and summary", async () => {
  const { summary, detail, versionId } = await Effect.runPromise(
    Effect.gen(function* () {
      const forms = yield* Forms;
      const { form } = yield* forms.create(admin, definition("Draft title"));
      const versionId = crypto.randomUUID();
      yield* publishWithoutDraft(form.id, versionId, "Published title");
      const summary = (yield* forms.list(admin)).find((summary) => summary.id === form.id);
      return { summary, detail: yield* forms.detail(admin, form.id), versionId };
    }).pipe(Effect.provide(FormModuleLive.pipe(Layer.provideMerge(DatabaseTest)))),
  );

  const currentVersion = {
    id: versionId,
    number: 1,
    publishedAt: new Date("2026-10-21T00:00:00Z"),
    publishedBy: "acme-admin",
    derivedFromVersionId: null,
    isCurrent: true,
  };
  expect(summary).toMatchObject({ title: "Published title", hasDraft: false, currentVersion });
  expect(detail).toMatchObject({ draft: null, currentVersion });
});
