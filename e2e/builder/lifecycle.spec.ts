import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("an admin creates a form, deletes it and no longer finds it in the list", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "acme-admin" }).click();

  const title = `Deleted in e2e ${randomUUID()}`;
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create form" }).click();
  await page.getByRole("link", { name: title }).click();

  await page.getByRole("button", { name: "Delete form" }).click();
  await expect(page.getByRole("button", { name: "Discard draft" })).toHaveCount(0);
  await page.getByRole("button", { name: "Delete permanently" }).click();

  await expect(page).toHaveURL("http://localhost:4174/");
  await expect(page.getByRole("list").or(page.getByText("No forms yet"))).toBeVisible();
  await expect(page.getByRole("link", { name: title })).toHaveCount(0);
});
