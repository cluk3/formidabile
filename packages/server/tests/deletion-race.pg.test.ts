import { FormModuleLive, Forms, Publication } from "@fb/server";
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

const definition = {
  format: 1 as const,
  title: "Delete or publish",
  questions: [
    {
      id: crypto.randomUUID(),
      type: "boolean" as const,
      label: "Ready?",
      required: true,
      config: {},
    },
  ],
};

const rounds = 20;

/** Creates a form, then fires a delete and a publish of its first draft at the same instant. */
const race = Effect.gen(function* () {
  const forms = yield* Forms;
  const publication = yield* Publication;
  const { form, draft } = yield* forms.create(admin, definition);
  const [deleted, published] = yield* Effect.all(
    [
      Effect.result(forms.delete(admin, form.id, draft.revision)),
      Effect.result(publication.publish(admin, form.id, draft.revision)),
    ],
    { concurrency: "unbounded" },
  );
  return {
    deleted,
    published,
    versions: yield* Effect.result(publication.versions(admin, form.id)),
  };
});

test("a delete racing a publish either removes the form with no version, or loses to the publish with FormPublished", async () => {
  const outcomes = await Effect.runPromise(
    Effect.forEach(Array.from({ length: rounds }), () => race).pipe(
      Effect.provide(FormModuleLive.pipe(Layer.provide(DatabaseTestPostgres(databaseUrl)))),
    ),
  );

  for (const outcome of outcomes) {
    if (outcome.deleted._tag === "Success") {
      // Delete first: the publish found no form, and no version was left behind.
      expect(outcome.published).toMatchObject({ failure: { _tag: "NotFound" } });
      expect(outcome.versions).toMatchObject({ failure: { _tag: "NotFound" } });
    } else {
      // Publish first: the form stays, with the version it published.
      expect(outcome.deleted).toMatchObject({ failure: { _tag: "FormPublished" } });
      expect(outcome.published._tag).toBe("Success");
      expect(outcome.versions).toMatchObject({ success: [{ number: 1 }] });
    }
  }
}, 60_000);
