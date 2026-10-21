import { Drafts, FormModuleLive, Forms, Publication } from "@fb/server";
import { Actor, TenantId } from "@fb/server/actor";
import { DatabaseTest } from "@fb/server/testing";
import { Cause, Effect, Exit, Layer, Option } from "effect";
import { SqlClient } from "effect/sql";
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

const services = Effect.all({ forms: Forms, drafts: Drafts, publication: Publication });

test("publish creates v1, and editing the draft afterwards leaves v1 unchanged", async () => {
  const first = definition("Customer survey");
  const { published, versions, v1 } = await run(
    Effect.gen(function* () {
      const { forms, drafts, publication } = yield* services;
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

test("publishing again creates v2 from v1, leaves v1 unchanged and moves the current version", async () => {
  const first = definition("Customer survey");
  const second = definition("Customer survey, revised");
  const { v1, v2, versions, oldV1 } = await run(
    Effect.gen(function* () {
      const { forms, drafts, publication } = yield* services;
      const { form, draft } = yield* forms.create(admin, first);
      const v1 = yield* publication.publish(admin, form.id, draft.revision);
      const next = yield* drafts.save(admin, form.id, {
        expectedRevision: null,
        definition: second,
      });
      const v2 = yield* publication.publish(admin, form.id, next.revision);
      return {
        v1,
        v2,
        versions: yield* publication.versions(admin, form.id),
        oldV1: yield* publication.version(admin, form.id, v1.version.id),
      };
    }),
  );

  expect(v2.version).toMatchObject({
    number: 2,
    derivedFromVersionId: v1.version.id,
    isCurrent: true,
  });
  expect(v2.form.currentVersionId).toBe(v2.version.id);
  expect(versions).toEqual([v2.version, { ...v1.version, isCurrent: false }]);
  expect(oldV1).toEqual({ ...v1.version, isCurrent: false, definition: first });
});

test("publishing an incomplete draft returns every problem, and changes neither the current version nor the draft", async () => {
  const { error, current, draft, saved } = await run(
    Effect.gen(function* () {
      const { forms, drafts, publication } = yield* services;
      const { form, draft } = yield* forms.create(admin, definition("Complete"));
      const v1 = yield* publication.publish(admin, form.id, draft.revision);
      const saved = yield* drafts.save(admin, form.id, {
        expectedRevision: null,
        definition: definition("", []),
      });
      const error = yield* Effect.flip(publication.publish(admin, form.id, saved.revision));
      return {
        error,
        current: { before: v1.version, after: yield* publication.versions(admin, form.id) },
        draft: yield* drafts.read(admin, form.id),
        saved,
      };
    }),
  );

  expect(error).toMatchObject({
    _tag: "ValidationFailed",
    issues: [
      { path: ["title"], message: expect.any(String) },
      { path: ["questions"], message: expect.any(String) },
    ],
  });
  expect(current.after).toEqual([current.before]);
  expect(draft).toEqual(saved);
});

test("a failure after the version row is inserted rolls back everything and keeps the draft", async () => {
  const { exit, versions, v1, draft, saved } = await run(
    Effect.gen(function* () {
      const { forms, drafts, publication } = yield* services;
      const sql = yield* SqlClient.SqlClient;
      const { form, draft } = yield* forms.create(admin, definition("Before the failure"));
      const v1 = yield* publication.publish(admin, form.id, draft.revision);
      const saved = yield* drafts.save(admin, form.id, {
        expectedRevision: null,
        definition: definition("Never published"),
      });
      yield* sql`
        CREATE FUNCTION form_management.fail_moving_current_version() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$
      `;
      yield* sql`
        CREATE TRIGGER fail_moving_current_version
        BEFORE UPDATE OF current_version_id ON form_management.forms
        FOR EACH ROW EXECUTE FUNCTION form_management.fail_moving_current_version()
      `;
      const exit = yield* Effect.exit(publication.publish(admin, form.id, saved.revision));
      return {
        exit,
        versions: yield* publication.versions(admin, form.id),
        v1: v1.version,
        draft: yield* drafts.read(admin, form.id),
        saved,
      };
    }),
  );

  expect(Exit.isFailure(exit) && Cause.pretty(exit.cause)).toContain("injected failure");
  expect(versions).toEqual([v1]);
  expect(draft).toEqual(saved);
});

test("draft revisions never repeat, and a stale expectedRevision gives RevisionConflict", async () => {
  const { revisions, stale, draft } = await run(
    Effect.gen(function* () {
      const { forms, drafts, publication } = yield* services;
      const created = yield* forms.create(admin, definition("First"));
      const formId = created.form.id;
      const saved = yield* drafts.save(admin, formId, {
        expectedRevision: created.draft.revision,
        definition: definition("Second"),
      });
      yield* publication.publish(admin, formId, saved.revision);
      const recreated = yield* drafts.save(admin, formId, {
        expectedRevision: null,
        definition: definition("Third"),
      });
      yield* drafts.discard(admin, formId, recreated.revision);
      const again = yield* drafts.save(admin, formId, {
        expectedRevision: null,
        definition: definition("Fourth"),
      });
      const stale = yield* Effect.flip(
        drafts.save(admin, formId, {
          expectedRevision: recreated.revision,
          definition: definition("Overwrite"),
        }),
      );
      return {
        revisions: [created.draft, saved, recreated, again].map((d) => d.revision),
        stale,
        draft: { expected: again, actual: yield* drafts.read(admin, formId) },
      };
    }),
  );

  expect(new Set(revisions).size).toBe(revisions.length);
  expect(stale).toMatchObject({ _tag: "RevisionConflict" });
  expect(draft.actual).toEqual(draft.expected);
});

test("after a publish, a stale save gives NoDraft and a save with no expected revision starts from the new version", async () => {
  const next = definition("Next edit");
  const { stale, recreated, published } = await run(
    Effect.gen(function* () {
      const { forms, drafts, publication } = yield* services;
      const { form, draft } = yield* forms.create(admin, definition("Published"));
      const published = yield* publication.publish(admin, form.id, draft.revision);
      const stale = yield* Effect.flip(
        drafts.save(admin, form.id, {
          expectedRevision: draft.revision,
          definition: definition("Lost edit"),
        }),
      );
      const recreated = yield* drafts.save(admin, form.id, {
        expectedRevision: null,
        definition: next,
      });
      return { stale, recreated, published };
    }),
  );

  expect(stale).toMatchObject({ _tag: "NoDraft" });
  expect(recreated).toMatchObject({
    basedOnVersionId: published.version.id,
    definition: next,
  });
});

test("saving with no expected revision while a draft exists gives RevisionConflict", async () => {
  const error = await run(
    Effect.gen(function* () {
      const { forms, drafts } = yield* services;
      const { form } = yield* forms.create(admin, definition("Has a draft"));
      return yield* Effect.flip(
        drafts.save(admin, form.id, { expectedRevision: null, definition: definition("Again") }),
      );
    }),
  );

  expect(error).toMatchObject({ _tag: "RevisionConflict" });
});

test("a save then a publish with the stale revision gives RevisionConflict and no new version", async () => {
  const { error, versions, draft, saved } = await run(
    Effect.gen(function* () {
      const { forms, drafts, publication } = yield* services;
      const { form, draft } = yield* forms.create(admin, definition("Original"));
      const saved = yield* drafts.save(admin, form.id, {
        expectedRevision: draft.revision,
        definition: definition("Edited"),
      });
      const error = yield* Effect.flip(publication.publish(admin, form.id, draft.revision));
      return {
        error,
        versions: yield* publication.versions(admin, form.id),
        draft: yield* drafts.read(admin, form.id),
        saved,
      };
    }),
  );

  expect(error).toMatchObject({ _tag: "RevisionConflict" });
  expect(versions).toEqual([]);
  expect(draft).toEqual(saved);
});

test("publishing a form with no draft gives NoDraft", async () => {
  const error = await run(
    Effect.gen(function* () {
      const { forms, publication } = yield* services;
      const { form, draft } = yield* forms.create(admin, definition("Once"));
      yield* publication.publish(admin, form.id, draft.revision);
      return yield* Effect.flip(publication.publish(admin, form.id, draft.revision));
    }),
  );

  expect(error).toMatchObject({ _tag: "NoDraft" });
});

test("discarding a published form's draft leaves the current version, and discarding a never-published form's draft gives FormNotPublished", async () => {
  const { discarded, notPublished, kept } = await run(
    Effect.gen(function* () {
      const { forms, drafts, publication } = yield* services;
      const published = yield* forms.create(admin, definition("Published"));
      yield* publication.publish(admin, published.form.id, published.draft.revision);
      const edit = yield* drafts.save(admin, published.form.id, {
        expectedRevision: null,
        definition: definition("Unwanted edit"),
      });
      yield* drafts.discard(admin, published.form.id, edit.revision);

      const never = yield* forms.create(admin, definition("Never published"));
      return {
        discarded: {
          draft: yield* drafts.read(admin, published.form.id),
          detail: yield* forms.detail(admin, published.form.id),
        },
        notPublished: yield* Effect.flip(
          drafts.discard(admin, never.form.id, never.draft.revision),
        ),
        kept: { expected: never.draft, actual: yield* drafts.read(admin, never.form.id) },
      };
    }),
  );

  expect(discarded.draft).toBeNull();
  expect(discarded.detail.currentVersion).toMatchObject({ number: 1 });
  expect(notPublished).toMatchObject({ _tag: "FormNotPublished" });
  expect(kept.actual).toEqual(kept.expected);
});

test("another tenant's admin gets NotFound for every draft and version operation", async () => {
  const globex = Actor.Identified({
    ...admin,
    subject: "globex-admin",
    tenant: TenantId.make("globex"),
  });
  const errors = await run(
    Effect.gen(function* () {
      const { forms, drafts, publication } = yield* services;
      const { form, draft } = yield* forms.create(admin, definition("Acme only"));
      const { version } = yield* publication.publish(admin, form.id, draft.revision);
      const next = yield* drafts.save(admin, form.id, {
        expectedRevision: null,
        definition: definition("Acme edit"),
      });
      return yield* Effect.all([
        Effect.flip(drafts.read(globex, form.id)),
        Effect.flip(
          drafts.save(globex, form.id, { expectedRevision: null, definition: definition("x") }),
        ),
        Effect.flip(drafts.discard(globex, form.id, next.revision)),
        Effect.flip(publication.publish(globex, form.id, next.revision)),
        Effect.flip(publication.versions(globex, form.id)),
        Effect.flip(publication.version(globex, form.id, version.id)),
      ]);
    }),
  );

  expect(errors.map((error) => error._tag)).toEqual(Array(6).fill("NotFound"));
});
