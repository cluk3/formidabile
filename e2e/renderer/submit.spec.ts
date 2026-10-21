import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { seedProject } from "./projects.ts";

const ids = Array.from({ length: 7 }, () => randomUUID());

// One question of each of the seven types.
const questions = [
  {
    id: ids[0],
    type: "text",
    label: "Your name",
    required: true,
    config: { display: "single_line" },
  },
  { id: ids[1], type: "email", label: "Email", required: true, config: {} },
  {
    id: ids[2],
    type: "number",
    label: "Guests",
    required: true,
    config: { integer: true, min: 1 },
  },
  { id: ids[3], type: "date", label: "Arrival date", required: true, config: {} },
  {
    id: ids[4],
    type: "single_choice",
    label: "Meal",
    required: true,
    config: {
      display: "radio",
      options: [
        { value: "veg", label: "Vegetarian" },
        { value: "fish", label: "Fish" },
      ],
    },
  },
  {
    id: ids[5],
    type: "multiple_choice",
    label: "Workshops",
    required: true,
    config: {
      options: [
        { value: "svelte", label: "Svelte" },
        { value: "zod", label: "Zod" },
      ],
    },
  },
  { id: ids[6], type: "boolean", label: "Need parking?", required: true, config: {} },
];

test("a respondent loads the project's form, fills in all seven types and submits", async ({
  page,
  request,
}) => {
  const title = `Event sign-up ${randomUUID()}`;
  const {
    projectId,
    ids: formIds,
    api,
  } = await seedProject(request, [{ title, availability: "open", questions }]);

  await page.goto(`/projects/${projectId}`);
  const element = page.locator("form-renderer");
  await expect(element.getByRole("heading", { name: title })).toBeVisible();

  // Every required label ends in "(required)", so labels match as substrings.
  await element.getByLabel("Your name").fill("Ada Lovelace");
  await element.getByLabel("Email").fill("ada@example.com");
  await element.getByLabel("Guests").fill("3");
  await element.getByLabel("Arrival date").fill("2026-05-04");
  await element.getByRole("radio", { name: "Fish" }).check();
  await element.getByRole("checkbox", { name: "Svelte" }).check();
  await element.getByRole("checkbox", { name: "Zod" }).check();
  await element.getByRole("radio", { name: "No" }).check();
  const [submitted] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith(`/api/respond/forms/${formIds[0]}/responses`),
    ),
    element.getByRole("button", { name: "Submit" }).click(),
  ]);

  await expect(element.getByText("Thank you, your response was received.")).toBeVisible();
  expect(submitted.status()).toBe(201);
  const { responseId } = (await submitted.json()) as { responseId: string };
  const { response } = await api("GET", `/responses/${responseId}`);
  expect(response).toMatchObject({
    formId: formIds[0],
    externalRefs: [{ namespace: "project", refId: projectId }],
    answers: {
      [ids[0]!]: "Ada Lovelace",
      [ids[1]!]: "ada@example.com",
      [ids[2]!]: 3,
      [ids[3]!]: "2026-05-04",
      [ids[4]!]: "fish",
      [ids[5]!]: ["svelte", "zod"],
      [ids[6]!]: false,
    },
  });
});
