import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { seedProject } from "./projects.ts";

test("the form for project X mounts the element for the project's one open form", async ({
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
