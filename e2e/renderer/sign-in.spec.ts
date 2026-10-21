import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { seedProject } from "./projects.ts";

// No test here signs the page in, so the respondent is the reference host's anonymous dev user.

test("the anonymous dev user submits to an unlimited form", async ({ page, request }) => {
  const title = `Open feedback ${randomUUID()}`;
  const { projectId, ids, api } = await seedProject(request, [{ title, availability: "open" }]);

  await page.goto(`/projects/${projectId}`);
  const element = page.locator("form-renderer");
  await element.getByRole("radio", { name: "Yes" }).check();
  const [reply] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith(`/api/respond/forms/${ids[0]}/responses`),
    ),
    element.getByRole("button", { name: "Submit" }).click(),
  ]);

  await expect(element.getByText("Thank you, your response was received.")).toBeVisible();
  const { responseId } = (await reply.json()) as { responseId: string };
  const { response } = await api("GET", `/responses/${responseId}`);
  expect(response).toMatchObject({ respondentId: null, formId: ids[0] });
});

test("the anonymous dev user is prompted to sign in on a form limited to one response each", async ({
  page,
  request,
}) => {
  const title = `One each ${randomUUID()}`;
  const { projectId, ids, api } = await seedProject(request, [{ title, availability: "open" }]);
  await api("PATCH", `/forms/${ids[0]}`, { responseLimit: "one_per_respondent" });

  await page.goto(`/projects/${projectId}`);
  const element = page.locator("form-renderer");
  await expect(element.getByRole("alert")).toHaveText("Sign in to respond to this form.");
  await expect(element.getByRole("button", { name: "Submit" })).toHaveCount(0);

  // The host offers its sign-in page, which brings the respondent back to the form.
  await page.getByRole("link", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "alice" }).click();
  await expect(element.getByRole("heading", { name: title })).toBeVisible();
  await expect(element.getByRole("button", { name: "Submit" })).toBeVisible();
});
