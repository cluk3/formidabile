import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { openAdminPage, seedProject } from "./projects.ts";

test("the form for project X mounts the element for the project's one open form, and its response is listed under the project", async ({
  page,
  request,
}) => {
  const title = `Project form ${randomUUID()}`;
  const { projectId, ids } = await seedProject(request, [
    { title, availability: "open" },
    { title: `Old form ${randomUUID()}`, availability: "closed" },
  ]);

  await page.goto(`/projects/${projectId}`);

  const element = page.locator("form-renderer");
  await expect(element).toHaveAttribute("form-id", ids[0]!);
  await expect(element.locator(".title")).toHaveText(title);

  await element.getByRole("radio", { name: "Yes" }).check();
  const [submitted] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith(`/api/respond/forms/${ids[0]}/responses`),
    ),
    element.getByRole("button", { name: "Submit" }).click(),
  ]);
  await expect(element.getByText("Thank you, your response was received.")).toBeVisible();
  const { responseId } = (await submitted.json()) as { responseId: string };

  const section = await openAdminPage(page, projectId);
  const responses = section.getByRole("list", { name: "Responses under this project" });
  await expect(responses.getByRole("listitem")).toHaveCount(1);
  await expect(responses.getByRole("listitem")).toContainText(`${title}, version 1: submitted`);
  await expect(responses.getByRole("listitem")).toContainText("by an anonymous respondent");
  await expect(responses.getByRole("listitem")).toContainText(responseId);
});

test("a project with no open form shows a static page and mounts no element", async ({
  page,
  request,
}) => {
  const { projectId } = await seedProject(request, [
    { title: `Closed form ${randomUUID()}`, availability: "closed" },
  ]);

  await page.goto(`/projects/${projectId}`);

  await expect(page.getByRole("heading", { name: "No open form for this project" })).toBeVisible();
  await expect(page.locator("form-renderer")).toHaveCount(0);
});

test("a project with several open forms lists their titles and mounts no element", async ({
  page,
  request,
}) => {
  const titles = [`First open form ${randomUUID()}`, `Second open form ${randomUUID()}`];
  const { projectId } = await seedProject(
    request,
    titles.map((title) => ({ title, availability: "open" as const })),
  );

  await page.goto(`/projects/${projectId}`);

  await expect(
    page.getByRole("heading", { name: "This project has several open forms" }),
  ).toBeVisible();
  for (const title of titles)
    await expect(page.getByRole("listitem").filter({ hasText: title })).toBeVisible();
  await expect(page.locator("form-renderer")).toHaveCount(0);
});
