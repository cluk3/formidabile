import { Drafts, FormModuleLive, Forms, Publication } from "@fb/server";
import { Actor, TenantId } from "@fb/server/actor";
import { DatabaseTest } from "@fb/server/testing";
import { Effect, Layer, Option } from "effect";
import { describe, expect, test } from "vite-plus/test";

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

const run = <A, E>(effect: Effect.Effect<A, E, Forms | Drafts | Publication>) =>
  Effect.runPromise(effect.pipe(Effect.provide(FormModuleLive.pipe(Layer.provide(DatabaseTest)))));

const services = Effect.all({ forms: Forms, drafts: Drafts, publication: Publication });

describe("deleting a form", () => {
  test("deleting a never-published form removes it with its draft", async () => {
    const { listed, detail, draft } = await run(
      Effect.gen(function* () {
        const { forms, drafts } = yield* services;
        const { form, draft } = yield* forms.create(admin, definition("Throwaway"));
        yield* forms.delete(admin, form.id, draft.revision);
        return {
          listed: (yield* forms.list(admin)).map((summary) => summary.id),
          detail: yield* Effect.flip(forms.detail(admin, form.id)),
          draft: yield* Effect.flip(drafts.read(admin, form.id)),
        };
      }),
    );

    expect(listed).toEqual([]);
    expect(detail._tag).toBe("NotFound");
    expect(draft._tag).toBe("NotFound");
  });

  test("deleting a published form gives FormPublished, whether its draft is current or stale", async () => {
    const { current, stale, versions } = await run(
      Effect.gen(function* () {
        const { forms, drafts, publication } = yield* services;
        const { form, draft } = yield* forms.create(admin, definition("Published"));
        yield* publication.publish(admin, form.id, draft.revision);
        const edit = yield* drafts.save(admin, form.id, {
          expectedRevision: null,
          definition: definition("Edited"),
        });
        return {
          current: yield* Effect.flip(forms.delete(admin, form.id, edit.revision)),
          stale: yield* Effect.flip(forms.delete(admin, form.id, draft.revision)),
          versions: yield* publication.versions(admin, form.id),
        };
      }),
    );

    expect(current._tag).toBe("FormPublished");
    expect(stale._tag).toBe("FormPublished");
    expect(versions).toHaveLength(1);
  });

  test("deleting with a stale revision gives RevisionConflict and keeps the newer draft", async () => {
    const { error, draft, saved } = await run(
      Effect.gen(function* () {
        const { forms, drafts } = yield* services;
        const { form, draft } = yield* forms.create(admin, definition("Shared"));
        const saved = yield* drafts.save(admin, form.id, {
          expectedRevision: draft.revision,
          definition: definition("Another admin's edit"),
        });
        return {
          error: yield* Effect.flip(forms.delete(admin, form.id, draft.revision)),
          draft: yield* drafts.read(admin, form.id),
          saved,
        };
      }),
    );

    expect(error._tag).toBe("RevisionConflict");
    expect(draft).toEqual(saved);
  });

  test("deleting another tenant's form gives NotFound and leaves it in place", async () => {
    const globexAdmin = Actor.Identified({ ...admin, tenant: TenantId.make("globex") });
    const { error, detail } = await run(
      Effect.gen(function* () {
        const { forms } = yield* services;
        const { form, draft } = yield* forms.create(admin, definition("Acme only"));
        return {
          error: yield* Effect.flip(forms.delete(globexAdmin, form.id, draft.revision)),
          detail: yield* forms.detail(admin, form.id),
        };
      }),
    );

    expect(error._tag).toBe("NotFound");
    expect(detail.draft).not.toBeNull();
  });
});
