import {
  validateForPublish,
  type FormDefinition,
  type QuestionSnapshot,
} from "@fb/core/definition";
import { JUMPS_CAP } from "@fb/core/editing";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { createBuilderClient } from "#lib/api.ts";
import DraftEditor from "#lib/DraftEditor.svelte";
import { config, fakeHost, json } from "./fake-host.ts";

const formId = "0192f0c4-0000-7000-8000-00000000f501";
const cityId = "0192f0c4-0000-7000-8000-00000000f511";
const detailId = "0192f0c4-0000-7000-8000-00000000f512";
const pageA = "0192f0c4-0000-7000-8000-00000000f5a1";
const pageB = "0192f0c4-0000-7000-8000-00000000f5a2";

const text = (id: string, label: string): QuestionSnapshot => ({
  id,
  type: "text",
  label,
  required: true,
  config: { display: "single_line" },
});

const city = text(cityId, "City");
const detail = text(detailId, "Details");

type SaveBody = { expectedRevision: string | null; definition: FormDefinition };

const hostFor = (definition: FormDefinition) => {
  let draft = {
    formId,
    revision: "r0",
    basedOnVersionId: null,
    definition,
    updatedAt: "2026-10-21T08:00:00.000Z",
  };
  const saves: SaveBody[] = [];
  const fetch = fakeHost(async (route, request) => {
    if (route === `GET /forms/${formId}/draft`) return json(200, { draft });
    if (route === `GET /forms/${formId}`)
      return json(200, {
        id: formId,
        availability: "closed",
        responseLimit: "unlimited",
        currentVersion: null,
        externalRefs: [],
      });
    if (route === `PUT /forms/${formId}/draft`) {
      const body: SaveBody = await request.json();
      saves.push(body);
      draft = { ...draft, revision: `r${saves.length}`, definition: body.definition };
      return json(200, draft);
    }
    if (route === `POST /forms/${formId}/draft/publish`) {
      const checked = validateForPublish(draft.definition, []);
      if (!checked.ok) return json(422, { _tag: "ValidationFailed", issues: checked.issues });
      return json(201, {
        form: {
          id: formId,
          availability: "closed",
          responseLimit: "unlimited",
          currentVersionId: crypto.randomUUID(),
          createdAt: "2026-10-21T08:00:00.000Z",
          updatedAt: "2026-10-21T08:00:00.000Z",
        },
        version: {
          id: crypto.randomUUID(),
          number: 1,
          publishedAt: "2026-10-21T08:00:00.000Z",
          publishedBy: "acme-admin",
          derivedFromVersionId: null,
          isCurrent: true,
        },
      });
    }
    return json(404, { _tag: "NotFound" });
  });
  return { fetch, saves };
};

const renderEditor = (fetch: typeof globalThis.fetch) =>
  render(DraftEditor, {
    client: createBuilderClient(config, fetch),
    formId,
    signInHref: config.loginUrl,
    onDeleted: () => {},
  });

const savedPages = (saves: SaveBody[]) => {
  const body = saves.at(-1)?.definition;
  if (body?.format !== 2) throw new Error("expected a format 2 save");
  return body.pages;
};

test("an editor adds, reorders, retargets, and removes a page's jumps", async () => {
  const host = hostFor({ format: 1, title: "Survey", questions: [city, detail] });
  const screen = await renderEditor(host.fetch);
  const first = screen.getByRole("region", { name: "Page 1" });
  await expect.element(first.getByRole("region", { name: "Jumps" })).toBeVisible();

  await screen.getByRole("button", { name: "Add page" }).click();
  await first.getByRole("button", { name: "Add jump" }).click();
  const jump = first.getByRole("region", { name: "Jump 1" });
  await jump.getByLabelText("Value").fill("Rome");
  await jump.getByLabelText("Go to").selectOptions("Page 2");
  await first.getByRole("button", { name: "Add jump" }).click();
  const second = first.getByRole("region", { name: "Jump 2" });
  await second.getByLabelText("Value").fill("Milan");
  await second.getByLabelText("Go to").selectOptions("End of the form");
  await second.getByRole("button", { name: "Move jump up" }).click();

  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Draft saved")).toBeVisible();
  const jumps = savedPages(host.saves)[0]?.jumps;
  expect(jumps).toEqual([
    { condition: { questionId: city.id, operator: "equals", constant: "Milan" }, target: "end" },
    {
      condition: { questionId: city.id, operator: "equals", constant: "Rome" },
      target: savedPages(host.saves)[1]?.id,
    },
  ]);

  await first
    .getByRole("region", { name: "Jump 2" })
    .getByRole("button", { name: "Remove jump" })
    .click();
  await screen.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => host.saves.length).toBe(2);
  expect(savedPages(host.saves)[0]?.jumps).toEqual([jumps?.[0]]);
});

test("a jump whose target page moved earlier stays, marked broken, and publish refuses it", async () => {
  const definition: FormDefinition = {
    format: 2,
    title: "Survey",
    pages: [
      {
        id: pageA,
        title: "Start",
        questions: [city],
        jumps: [
          {
            condition: { questionId: city.id, operator: "equals", constant: "Rome" },
            target: pageB,
          },
        ],
      },
      { id: pageB, title: "Later", questions: [detail], jumps: [] },
    ],
  };
  const host = hostFor(definition);
  const screen = await renderEditor(host.fetch);
  const later = screen.getByRole("region", { name: "Later" });
  await expect.element(later).toBeVisible();
  expect(screen.getByText("Broken").elements()).toEqual([]);

  await later.getByRole("button", { name: "Move page up" }).click();
  const start = screen.getByRole("region", { name: "Start" });
  const jump = start.getByRole("region", { name: "Jump 1" });
  await expect.element(jump.getByText("Broken", { exact: true })).toBeVisible();
  await expect
    .element(jump.getByText("This jump does not go to a later page or the end"))
    .toBeVisible();
  await expect.element(jump.getByRole("option", { name: "Broken target" })).toBeInTheDocument();

  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Draft saved")).toBeVisible();
  expect(savedPages(host.saves)[1]?.jumps[0]?.target).toBe(pageB);

  await screen.getByRole("button", { name: "Publish" }).click();
  const alert = screen.getByRole("alert");
  await expect.element(alert.getByText("The draft couldn't be published:")).toBeVisible();
  await expect
    .element(alert.getByText("This jump does not go to a later page or the end"))
    .toBeVisible();
  expect(screen.getByText("Published version 1").elements()).toEqual([]);
});

test("an unreachable question and page are warned about, and the warning does not block publish", async () => {
  const definition: FormDefinition = {
    format: 2,
    title: "Survey",
    pages: [
      { id: pageA, title: "Start", questions: [city], jumps: [] },
      {
        id: pageB,
        title: "Later",
        questions: [
          {
            id: detailId,
            type: "text",
            label: "Details",
            required: true,
            config: { display: "single_line" },
            showCondition: {
              all: [
                { questionId: cityId, operator: "equals", constant: "Rome" },
                { questionId: cityId, operator: "does_not_equal", constant: "Rome" },
              ],
            },
          },
        ],
        jumps: [],
      },
    ],
  };
  const host = hostFor(definition);
  const screen = await renderEditor(host.fetch);
  const later = screen.getByRole("region", { name: "Later" });
  const warnings = later.getByRole("list", { name: "Reachability warnings" });
  await expect.element(warnings.getByText("Details cannot be reached")).toBeVisible();
  await expect.element(warnings.getByText("This page cannot be reached")).toBeVisible();

  await screen.getByRole("button", { name: "Publish" }).click();
  await expect.element(screen.getByText("Published version 1")).toBeVisible();
  expect(screen.getByText("The draft couldn't be published:").elements()).toEqual([]);
});

test("a page accepts at most 20 jumps", async () => {
  const jumps = Array.from({ length: JUMPS_CAP }, () => ({
    condition: { questionId: cityId, operator: "is_answered" },
    target: "end" as const,
  }));
  const host = hostFor({
    format: 2,
    title: "Survey",
    pages: [
      { id: pageA, questions: [city], jumps },
      { id: pageB, questions: [detail], jumps: [] },
    ],
  });
  const screen = await renderEditor(host.fetch);
  const first = screen.getByRole("region", { name: "Page 1" });
  await expect.element(first.getByRole("region", { name: "Jump 20" })).toBeVisible();
  await expect.element(first.getByRole("button", { name: "Add jump" })).toBeDisabled();
});
