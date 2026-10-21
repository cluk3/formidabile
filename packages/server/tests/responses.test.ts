import { Drafts, FormModuleLive, Forms, Publication, Responses, Submission } from "@fb/server";
import { Actor, type ExternalRef, TenantId } from "@fb/server/actor";
import { DatabaseTest } from "@fb/server/testing";
import { Effect, Layer, Option } from "effect";
import { describe, expect, test } from "vite-plus/test";

const acme = TenantId.make("acme");

const admin = Actor.Identified({
  subject: "acme-admin",
  tenant: acme,
  capabilities: ["forms:manage", "responses:read"],
  formId: Option.none(),
  refs: [],
});

const respondent = (
  subject: string,
  binding: { formId?: string; refs?: ReadonlyArray<ExternalRef> } = {},
) =>
  Actor.Identified({
    subject,
    tenant: acme,
    capabilities: [],
    formId: Option.fromNullishOr(binding.formId),
    refs: binding.refs ?? [],
  });

const alice = respondent("alice");
const bob = respondent("bob");

const readyId = "0192f5a0-7c3e-7b1a-9d2e-000000000002";

const definition = (title: string) => ({
  format: 1 as const,
  title,
  questions: [
    { id: readyId, type: "boolean" as const, label: "Ready?", required: true, config: {} },
  ],
});

const answers = { [readyId]: true };

const run = <A, E>(
  effect: Effect.Effect<
    A,
    E,
    Forms | Drafts | Publication | Submission | Responses | Layer.Success<typeof DatabaseTest>
  >,
) =>
  Effect.runPromise(
    effect.pipe(Effect.provide(FormModuleLive.pipe(Layer.provideMerge(DatabaseTest)))),
  );

/** An open, unlimited form in `acme` with one published version. */
const openForm = (owner: Actor = admin) =>
  Effect.gen(function* () {
    const forms = yield* Forms;
    const publication = yield* Publication;
    const { form, draft } = yield* forms.create(owner, definition("Survey"));
    const { version } = yield* publication.publish(owner, form.id, draft.revision);
    yield* forms.updateSettings(owner, form.id, { availability: "open" });
    return { formId: form.id, v1: version };
  });

const submit = (actor: Actor, formId: string, versionId: string, given: unknown = answers) =>
  Submission.use((submission) =>
    submission.submit(actor, formId, {
      versionId,
      answers: given,
      idempotencyKey: crypto.randomUUID(),
    }),
  );

/** UUIDv7 ids order by time only across milliseconds, so newest-first needs a gap between submits. */
const tick = Effect.promise(() => new Promise((resolve) => setTimeout(resolve, 2)));

describe("list", () => {
  test("gives the tenant's responses newest first, as summaries without answers", async () => {
    const { listed, first, second, v1, formId } = await run(
      Effect.gen(function* () {
        const { formId, v1 } = yield* openForm();
        const first = yield* submit(alice, formId, v1.id);
        yield* tick;
        const second = yield* submit(bob, formId, v1.id);
        const listed = yield* Responses.use((responses) => responses.list(admin, {}));
        return { listed, first, second, v1, formId };
      }),
    );

    expect(listed).toEqual({
      responses: [
        {
          id: second.responseId,
          formId,
          versionId: v1.id,
          versionNumber: 1,
          respondentId: "bob",
          submittedAt: expect.any(Date),
          editedAt: null,
          externalRefs: [],
        },
        {
          id: first.responseId,
          formId,
          versionId: v1.id,
          versionNumber: 1,
          respondentId: "alice",
          submittedAt: expect.any(Date),
          editedAt: null,
          externalRefs: [],
        },
      ],
      nextCursor: null,
    });
  });
});
