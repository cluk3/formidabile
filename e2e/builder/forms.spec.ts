import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("an admin signs in through the host, creates a form and finds it in the list", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "acme-admin" }).click();
  await expect(page).toHaveURL("http://localhost:4174/");

  const title = `Created in e2e ${randomUUID()}`;
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create form" }).click();

  await expect(page.getByRole("listitem").filter({ hasText: title })).toBeVisible();
});
