import { Drafts, FormModuleLive, Forms, Publication } from "@fb/server";
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

const question = (label: string, id: string = crypto.randomUUID()) => ({
  id,
  type: "boolean" as const,
  label,
  required: true,
  config: {},
});

const definition = (title: string, questions = [question("Ready?")]) => ({
  format: 1 as const,
  title,
  questions,
});

const run = <A, E>(
  effect: Effect.Effect<A, E, Forms | Drafts | Publication | Layer.Success<typeof DatabaseTest>>,
) =>
  Effect.runPromise(
    effect.pipe(Effect.provide(FormModuleLive.pipe(Layer.provideMerge(DatabaseTest)))),
  );

test("publish creates v1, and editing the draft afterwards leaves v1 unchanged", async () => {
  const first = definition("Customer survey");
  const { published, versions, v1 } = await run(
    Effect.gen(function* () {
      const forms = yield* Forms;
      const drafts = yield* Drafts;
      const publication = yield* Publication;
      const { form, draft } = yield* forms.create(admin, first);
      const published = yield* publication.publish(admin, form.id, draft.revision);
      yield* drafts.save(admin, form.id, {
        expectedRevision: null,
        definition: definition("Renamed survey"),
      });
      return {
        published,
        versions: yield* publication.versions(admin, form.id),
        v1: yield* publication.version(admin, form.id, published.version.id),
      };
    }),
  );

  expect(published.version).toEqual({
    id: expect.any(String),
    number: 1,
    publishedAt: expect.any(Date),
    publishedBy: "acme-admin",
    derivedFromVersionId: null,
    isCurrent: true,
  });
  expect(published.form.currentVersionId).toBe(published.version.id);
  expect(versions).toEqual([published.version]);
  expect(v1).toEqual({ ...published.version, definition: first });
});
