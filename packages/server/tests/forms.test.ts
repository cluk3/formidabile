import { FormModuleLive, Forms, Publication } from "@fb/server";
import { Actor, TenantId } from "@fb/server/actor";
import { DatabaseTest } from "@fb/server/testing";
import { Effect, Layer, Option } from "effect";
import { expect, test } from "vite-plus/test";

const admin = Actor.Identified({
  subject: "acme-admin",
  tenant: TenantId.make("acme"),
  capabilities: ["forms:manage"],
  formId: Option.none(),
  refs: [],
});

const definition = (title: string) => ({
  format: 1,
  title,
  questions: [
    { id: crypto.randomUUID(), type: "boolean", label: "Ready?", required: true, config: {} },
  ],
});

test("a published form without a draft shows its current version's title and summary", async () => {
  const { summary, detail, version } = await Effect.runPromise(
    Effect.gen(function* () {
      const forms = yield* Forms;
      const publication = yield* Publication;
      const { form, draft } = yield* forms.create(admin, definition("Published title"));
      const { version } = yield* publication.publish(admin, form.id, draft.revision);
      const summary = (yield* forms.list(admin)).find((summary) => summary.id === form.id);
      return { summary, detail: yield* forms.detail(admin, form.id), version };
    }).pipe(Effect.provide(FormModuleLive.pipe(Layer.provideMerge(DatabaseTest)))),
  );

  const currentVersion = {
    id: version.id,
    number: 1,
    publishedAt: version.publishedAt,
    publishedBy: "acme-admin",
    derivedFromVersionId: null,
    isCurrent: true,
  };
  expect(summary).toMatchObject({ title: "Published title", hasDraft: false, currentVersion });
  expect(detail).toMatchObject({ draft: null, currentVersion });
});
