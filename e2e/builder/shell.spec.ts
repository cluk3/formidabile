import { expect, test } from "@playwright/test";

test("the shell loads and reads the runtime config.json", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Form builder" })).toBeVisible();
  // `loginUrl` comes from `static/config.json`, and nobody is signed in, so the page can only link to it after
  // fetching the file and being refused a token.
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    /^http:\/\/localhost:4173\/login\?/,
  );
});
