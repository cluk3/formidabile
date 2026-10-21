import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { seedProject } from "./projects.ts";

const text = (label: string) => ({
  id: randomUUID(),
  type: "text",
  label,
  required: true,
  config: { display: "single_line" },
});

const submitted = (page: Page, formId: string) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().endsWith(`/api/respond/forms/${formId}/responses`),
  );

test("a signed-in respondent submits, comes back to edit the same response, and saves it", async ({
  page,
  request,
}) => {
  const name = text("Your name");
  const title = `Workshop sign-up ${randomUUID()}`;
  const { projectId, ids, api } = await seedProject(request, [
    { title, availability: "open", questions: [name] },
  ]);
  const [formId] = ids as [string];
  await api("PATCH", `/forms/${formId}`, { responseLimit: "one_per_respondent" });
  await page.request.post("/login", { form: { user: "alice" } });

  await page.goto(`/projects/${projectId}`);
  const element = page.locator("form-renderer");
  await element.getByLabel("Your name").fill("Alice");
  const [reply] = await Promise.all([
    submitted(page, formId),
    element.getByRole("button", { name: "Submit" }).click(),
  ]);
  await expect(element.getByText("Thank you, your response was received.")).toBeVisible();
  const { responseId } = (await reply.json()) as { responseId: string };

  // The load now carries `myResponseId`, so the renderer opens that response for editing.
  await page.reload();
  await expect(element.getByLabel("Your name")).toHaveValue("Alice");
  await element.getByLabel("Your name").fill("Alice Liddell");
  await element.getByRole("button", { name: "Save changes" }).click();
  await expect(element.getByText("Your changes were saved.")).toBeVisible();

  const { response } = await api("GET", `/responses/${responseId}`);
  expect(response).toMatchObject({
    formId,
    respondentId: "alice",
    answers: { [name.id]: "Alice Liddell" },
    editedAt: expect.any(String),
  });
});

test("a new version published mid-session prompts a reload, and the response goes in on v2", async ({
  page,
  request,
}) => {
  const name = text("Your name");
  const team = text("Your team");
  const title = `Hackathon ${randomUUID()}`;
  const { projectId, ids, api } = await seedProject(request, [
    { title, availability: "open", questions: [name] },
  ]);
  const [formId] = ids as [string];

  await page.goto(`/projects/${projectId}`);
  const element = page.locator("form-renderer");
  await element.getByLabel("Your name").fill("Ada");

  const draft = await api("PUT", `/forms/${formId}/draft`, {
    expectedRevision: null,
    definition: { format: 1, title: `${title} v2`, questions: [name, team] },
  });
  await api("POST", `/forms/${formId}/draft/publish`, { expectedRevision: draft.revision });

  const [superseded] = await Promise.all([
    submitted(page, formId),
    element.getByRole("button", { name: "Submit" }).click(),
  ]);
  expect(superseded.status()).toBe(409);
  await expect(element.getByRole("alert")).toHaveText(
    "This form was updated while you were answering. Reload it to answer the new version. Your answers won't carry over.",
  );
  await element.getByRole("button", { name: "Reload" }).click();

  await expect(element.getByRole("heading", { name: `${title} v2` })).toBeVisible();
  await expect(element.getByLabel("Your name")).toHaveValue("");
  await element.getByLabel("Your name").fill("Ada");
  await element.getByLabel("Your team").fill("Engines");
  const [reply] = await Promise.all([
    submitted(page, formId),
    element.getByRole("button", { name: "Submit" }).click(),
  ]);
  await expect(element.getByText("Thank you, your response was received.")).toBeVisible();

  const { responseId } = (await reply.json()) as { responseId: string };
  const detail = await api("GET", `/responses/${responseId}`);
  expect(detail.version.number).toBe(2);
  expect(detail.response.answers).toEqual({ [name.id]: "Ada", [team.id]: "Engines" });
});
