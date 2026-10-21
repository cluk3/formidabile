import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("an admin opens a form's editor, adds a question and saves the draft", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "acme-admin" }).click();

  const title = `Edited in e2e ${randomUUID()}`;
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create form" }).click();
  await page.getByRole("link", { name: title }).click();

  await page.getByLabel("New question type").selectOption("Single choice");
  await page.getByRole("button", { name: "Add question" }).click();
  const question = page.getByRole("region", { name: "Question 1" });
  await question.getByLabel("Label", { exact: true }).fill("Favourite colour");
  await question.getByLabel("Option 1", { exact: true }).fill("Red");
  await question.getByLabel("Option 2", { exact: true }).fill("Blue");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Draft saved", { exact: true })).toBeVisible();

  await page.reload();
  await expect(question.getByLabel("Label", { exact: true })).toHaveValue("Favourite colour");
  await expect(question.getByLabel("Option 2", { exact: true })).toHaveValue("Blue");
});
