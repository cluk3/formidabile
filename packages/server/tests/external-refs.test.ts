import { FormModuleLive, Forms } from "@fb/server";
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

const analyst = Actor.Identified({ ...admin, capabilities: ["responses:read"] });

const globexAdmin = Actor.Identified({ ...admin, tenant: TenantId.make("globex") });

const definition = (title: string) => ({
  format: 1,
  title,
  questions: [
    { id: crypto.randomUUID(), type: "boolean", label: "Ready?", required: true, config: {} },
  ],
});

const run = <A, E>(effect: Effect.Effect<A, E, Forms>) =>
  Effect.runPromise(effect.pipe(Effect.provide(FormModuleLive.pipe(Layer.provide(DatabaseTest)))));

const createForm = (actor: Actor, title: string) =>
  Effect.flatMap(Forms, (forms) => forms.create(actor, definition(title))).pipe(
    Effect.map(({ form }) => form),
  );

describe("attaching and detaching references", () => {
  test("adding returns the whole set, sorted, and adding the same reference again changes nothing", async () => {
    const { first, again, detail } = await run(
      Effect.gen(function* () {
        const forms = yield* Forms;
        const form = yield* createForm(admin, "Referenced");
        yield* forms.addExternalRef(admin, form.id, { namespace: "project", refId: "p-2" });
        const first = yield* forms.addExternalRef(admin, form.id, {
          namespace: "crm.account",
          refId: "Ünïcödé id 🎉",
        });
        const again = yield* forms.addExternalRef(admin, form.id, {
          namespace: "project",
          refId: "p-2",
        });
        return { first, again, detail: yield* forms.detail(analyst, form.id) };
      }),
    );

    const expected = [
      { namespace: "crm.account", refId: "Ünïcödé id 🎉" },
      { namespace: "project", refId: "p-2" },
    ];
    expect(first).toEqual(expected);
    expect(again).toEqual(expected);
    expect(detail.externalRefs).toEqual(expected);
  });

  test("removing returns what's left, and removing a missing reference is a no-op", async () => {
    const { removed, missing } = await run(
      Effect.gen(function* () {
        const forms = yield* Forms;
        const form = yield* createForm(admin, "Detaching");
        yield* forms.addExternalRef(admin, form.id, { namespace: "a", refId: "1" });
        yield* forms.addExternalRef(admin, form.id, { namespace: "b", refId: "1" });
        const removed = yield* forms.removeExternalRef(admin, form.id, {
          namespace: "a",
          refId: "1",
        });
        const missing = yield* forms.removeExternalRef(admin, form.id, {
          namespace: "a",
          refId: "1",
        });
        return { removed, missing };
      }),
    );

    expect(removed).toEqual([{ namespace: "b", refId: "1" }]);
    expect(missing).toEqual([{ namespace: "b", refId: "1" }]);
  });

  test("a form holds 100 references: the 101st gives ExternalRefLimitReached, re-adding one still succeeds", async () => {
    const { error, readded, count } = await run(
      Effect.gen(function* () {
        const forms = yield* Forms;
        const form = yield* createForm(admin, "Full");
        for (let i = 0; i < 100; i++) {
          yield* forms.addExternalRef(admin, form.id, { namespace: "n", refId: `ref-${i}` });
        }
        return {
          error: yield* Effect.flip(
            forms.addExternalRef(admin, form.id, { namespace: "n", refId: "ref-100" }),
          ),
          readded: yield* forms.addExternalRef(admin, form.id, { namespace: "n", refId: "ref-0" }),
          count: (yield* forms.detail(admin, form.id)).externalRefs.length,
        };
      }),
    );

    expect(error).toMatchObject({ _tag: "ExternalRefLimitReached", limit: 100 });
    expect(readded).toHaveLength(100);
    expect(count).toBe(100);
  });

  test("changing references needs forms:manage", async () => {
    const errors = await run(
      Effect.gen(function* () {
        const forms = yield* Forms;
        const form = yield* createForm(admin, "Managed");
        const ref = { namespace: "project", refId: "p-1" };
        return yield* Effect.all([
          Effect.flip(forms.addExternalRef(analyst, form.id, ref)),
          Effect.flip(forms.removeExternalRef(analyst, form.id, ref)),
        ]);
      }),
    );

    for (const error of errors) {
      expect(error).toMatchObject({ _tag: "Forbidden", capability: "forms:manage" });
    }
  });

  test("another tenant's form gives NotFound, and keeps its references", async () => {
    const { errors, detail } = await run(
      Effect.gen(function* () {
        const forms = yield* Forms;
        const form = yield* createForm(admin, "Acme only");
        const ref = { namespace: "project", refId: "p-1" };
        yield* forms.addExternalRef(admin, form.id, ref);
        return {
          errors: yield* Effect.all([
            Effect.flip(forms.addExternalRef(globexAdmin, form.id, ref)),
            Effect.flip(forms.removeExternalRef(globexAdmin, form.id, ref)),
          ]),
          detail: yield* forms.detail(admin, form.id),
        };
      }),
    );

    expect(errors.map((error) => error._tag)).toEqual(["NotFound", "NotFound"]);
    expect(detail.externalRefs).toEqual([{ namespace: "project", refId: "p-1" }]);
  });
});

describe("looking forms up by reference", () => {
  test("every form in the tenant carrying the reference, most recently updated first", async () => {
    const { found, unknown, globex } = await run(
      Effect.gen(function* () {
        const forms = yield* Forms;
        const ref = { namespace: "ticket.queue", refId: "Q-7" };
        const older = yield* createForm(admin, "Older");
        const unrelated = yield* createForm(admin, "Unrelated");
        const newer = yield* createForm(admin, "Newer");
        const otherTenant = yield* createForm(globexAdmin, "Globex");
        yield* forms.addExternalRef(admin, older.id, ref);
        yield* forms.addExternalRef(admin, newer.id, ref);
        yield* forms.addExternalRef(admin, unrelated.id, {
          namespace: "ticket.queue",
          refId: "Q-8",
        });
        yield* forms.addExternalRef(globexAdmin, otherTenant.id, ref);
        // Settings bump `updatedAt`, so the older form moves to the top; the sleep rules out a tie.
        yield* Effect.sleep("2 millis");
        yield* forms.updateSettings(admin, older.id, { responseLimit: "one_per_respondent" });
        return {
          found: (yield* forms.list(analyst, ref)).map((form) => form.title),
          unknown: yield* forms.list(admin, { namespace: "ticket.queue", refId: "Q-9" }),
          globex: (yield* forms.list(globexAdmin, ref)).map((form) => form.title),
        };
      }),
    );

    expect(found).toEqual(["Older", "Newer"]);
    expect(unknown).toEqual([]);
    expect(globex).toEqual(["Globex"]);
  });

  test("a deleted form's references go with it", async () => {
    const found = await run(
      Effect.gen(function* () {
        const forms = yield* Forms;
        const ref = { namespace: "project", refId: "gone" };
        const { form, draft } = yield* forms.create(admin, definition("Throwaway"));
        yield* forms.addExternalRef(admin, form.id, ref);
        yield* forms.delete(admin, form.id, draft.revision);
        return yield* forms.list(admin, ref);
      }),
    );

    expect(found).toEqual([]);
  });
});
