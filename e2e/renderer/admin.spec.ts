import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { openAdminPage, seedProject } from "./projects.ts";

test("an admin adds the project to another form and removes it from the project's form", async ({
  page,
  request,
}) => {
  const title = `Spring orders ${randomUUID()}`;
  const { projectId, api } = await seedProject(request, [{ title, availability: "open" }]);
  const otherTitle = `Autumn orders ${randomUUID()}`;
  await api("POST", "/forms", { definition: { format: 1, title: otherTitle, questions: [] } });

  const section = await openAdminPage(page, projectId);
  const held = section.getByRole("list", { name: "Forms with this project" });
  await expect(held.getByRole("listitem")).toHaveText([`${title} (version 1, open) Remove`]);
  await expect(section.getByText("No responses under this project.")).toBeVisible();

  await section
    .getByLabel("Add the project to")
    .selectOption({ label: `${otherTitle} (never published)` });
  await section.getByRole("button", { name: "Add", exact: true }).click();
  await expect(held.getByRole("listitem")).toHaveCount(2);
  await expect(held.getByRole("listitem").filter({ hasText: otherTitle })).toBeVisible();

  await section.getByRole("button", { name: `Remove ${title}` }).click();
  await expect(held.getByRole("listitem")).toHaveText([`${otherTitle} (never published) Remove`]);
  await expect(section.getByRole("heading", { name: "Forms with this project" })).toBeFocused();

  // The project page follows the references: its one form was never published, so there's no open form.
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByRole("heading", { name: "No open form for this project" })).toBeVisible();
});

test("globex-admin manages their tenant's demo project, and only projects in their tenant", async ({
  page,
}) => {
  await page.goto(`/login?return=${encodeURIComponent("/admin")}`);
  await page.getByRole("button", { name: "globex-admin" }).click();

  const section = page.getByRole("region", { name: "Project globex-partner-summit" });
  await expect(section.getByRole("heading", { name: "Forms with this project" })).toBeVisible();
  await expect(
    section.getByRole("heading", { name: "Responses under this project" }),
  ).toBeVisible();
  await expect(section.getByRole("status")).toHaveText("");

  await page.goto("/admin?project=acme-spring-orders");
  await expect(page.getByRole("heading", { name: "No such project in your tenant" })).toBeVisible();
});
