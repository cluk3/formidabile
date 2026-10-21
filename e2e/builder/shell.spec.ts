import { expect, test } from "@playwright/test";

test("the shell loads and reads the runtime config.json", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Form builder" })).toBeVisible();
  // The value comes from `static/config.json`, so the page can only show it after fetching the file.
  await expect(page.getByTestId("api-base-url")).toHaveText("http://localhost:4173/api");
});
