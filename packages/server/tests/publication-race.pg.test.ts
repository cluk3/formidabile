import { Drafts, FormModuleLive, Forms, Publication } from "@fb/server";
import { Actor, TenantId } from "@fb/server/actor";
import { DatabaseTestPostgres } from "@fb/server/testing";
import { Effect, Layer, Option } from "effect";
import { expect, test } from "vite-plus/test";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("test:pg needs DATABASE_URL");

const admin = Actor.Identified({
  subject: "acme-admin",
  tenant: TenantId.make("acme"),
  capabilities: ["forms:manage"],
  formId: Option.none(),
  refs: [],
});

const definition = (title: string) => ({
  format: 1 as const,
  title,
  questions: [
    {
      id: crypto.randomUUID(),
      type: "boolean" as const,
      label: "Ready?",
      required: true,
      config: {},
    },
  ],
});

const rounds = 20;

const run = <A, E>(effect: Effect.Effect<A, E, Forms | Drafts | Publication>) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(FormModuleLive.pipe(Layer.provide(DatabaseTestPostgres(databaseUrl)))),
    ),
  );

/** Creates a form, then fires a publish of its first draft and a save at the same instant. */
const race = (save: (revision: string) => { expectedRevision: string | null }) =>
  Effect.gen(function* () {
    const forms = yield* Forms;
    const drafts = yield* Drafts;
    const publication = yield* Publication;
    const original = definition("Original");
    const edit = definition("Edited");
    const { form, draft } = yield* forms.create(admin, original);
    const [published, saved] = yield* Effect.all(
      [
        Effect.result(publication.publish(admin, form.id, draft.revision)),
        Effect.result(drafts.save(admin, form.id, { ...save(draft.revision), definition: edit })),
      ],
      { concurrency: "unbounded" },
    );
    const versions = yield* publication.versions(admin, form.id);
    const definitions = yield* Effect.forEach(versions, (version) =>
      Effect.map(publication.version(admin, form.id, version.id), (v) => v.definition),
    );
    return {
      original,
      edit,
      published,
      saved,
      definitions,
      currentVersionId: (yield* forms.detail(admin, form.id)).currentVersion?.id ?? null,
      draft: yield* drafts.read(admin, form.id),
    };
  });

test("a save racing a publish of the same revision either wins and is kept, or finds no draft", async () => {
  const outcomes = await run(
    Effect.forEach(Array.from({ length: rounds }), () =>
      race((revision) => ({ expectedRevision: revision })),
    ),
  );

  for (const outcome of outcomes) {
    if (outcome.saved._tag === "Success") {
      // Save first: publish saw a new revision.
      expect(outcome.published).toMatchObject({ failure: { _tag: "RevisionConflict" } });
      expect(outcome.definitions).toEqual([]);
      expect(outcome.draft).toEqual(outcome.saved.success);
    } else {
      // Publish first: exactly one new version, holding the definition publish expected.
      expect(outcome.saved).toMatchObject({ failure: { _tag: "NoDraft" } });
      expect(outcome.published._tag).toBe("Success");
      expect(outcome.definitions).toEqual([outcome.original]);
      expect(outcome.draft).toBeNull();
    }
  }
}, 60_000);

test("a save of a new draft racing a publish never stops the publish, and a save that succeeds is kept", async () => {
  const outcomes = await run(
    Effect.forEach(Array.from({ length: rounds }), () => race(() => ({ expectedRevision: null }))),
  );

  for (const outcome of outcomes) {
    expect(outcome.published._tag).toBe("Success");
    expect(outcome.definitions).toEqual([outcome.original]);
    if (outcome.saved._tag === "Success") {
      // Publish first: the save started a draft from the new version.
      expect(outcome.saved.success.basedOnVersionId).toBe(outcome.currentVersionId);
      expect(outcome.draft).toEqual(outcome.saved.success);
    } else {
      // Save first: the draft publish was about to take still existed.
      expect(outcome.saved).toMatchObject({ failure: { _tag: "RevisionConflict" } });
      expect(outcome.draft).toBeNull();
    }
  }
}, 60_000);
