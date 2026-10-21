import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("an admin previews, publishes two versions and finds both in the history", async ({
  page,
}) => {
  const respondRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("/respond")) respondRequests.push(request.url());
  });

  await page.goto("/");
  await page.getByRole("link", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "acme-admin" }).click();

  const title = `Published in e2e ${randomUUID()}`;
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create form" }).click();
  await page.getByRole("link", { name: title }).click();

  await page.getByRole("button", { name: "Add question" }).click();
  const question = page.getByRole("region", { name: "Question 1" });
  await question.getByLabel("Label", { exact: true }).fill("Your name");

  await page.getByRole("button", { name: "Preview" }).click();
  const preview = page.getByRole("region", { name: "Preview" });
  await expect(preview.getByRole("heading", { name: title })).toBeVisible();
  await preview.getByLabel("Your name").fill("Ada");
  await preview.getByRole("button", { name: "Submit" }).click();
  await expect(
    preview.getByText("Preview: these answers are valid. Nothing was sent."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published version 1", { exact: true })).toBeVisible();

  await question.getByLabel("Label", { exact: true }).fill("Your full name");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();
  const history = page.getByRole("region", { name: "Publication history" });
  await expect(
    history.getByText("An unpublished draft, based on version 1, is open in the editor."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published version 2", { exact: true })).toBeVisible();

  await expect(history.getByText("Version 2 is current.")).toBeVisible();
  const versions = history.getByRole("listitem");
  await expect(versions).toHaveCount(2);
  await expect(versions.nth(0)).toContainText("Version 2");
  await expect(versions.nth(0).getByText("Current", { exact: true })).toBeVisible();
  await expect(versions.nth(1)).toContainText("Version 1");
  await expect(versions.nth(1).getByText("Current", { exact: true })).toHaveCount(0);

  await versions.nth(1).getByRole("button", { name: "Read version 1" }).click();
  await expect(
    history.getByRole("region", { name: "Version 1" }).getByLabel("Your name"),
  ).toBeVisible();

  expect(respondRequests).toEqual([]);
});
