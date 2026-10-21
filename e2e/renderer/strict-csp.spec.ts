import { expect, test } from "@playwright/test";

// The reference host serves its page under the strict CSP from ADR 0008 in `vp preview`. The element must render
// fully styled with no violation, from the outer tree, from a nested component, and through the host's theming.
test("the element renders styled under a strict CSP with no violations", async ({ page }) => {
  const problems: string[] = [];
  const violations: string[] = [];
  // The page reports each violation to this Node-side array, so nothing is read back off `window`.
  await page.exposeFunction("reportViolation", (description: string) => {
    violations.push(description);
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      // `exposeFunction` adds `reportViolation` to the page's globals, and the init script can't see its type.
      Reflect.get(window, "reportViolation")(`${event.violatedDirective}: ${event.blockedURI}`);
    });
  });
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));

  const response = await page.goto("/");
  expect(response?.headers()["content-security-policy"]).toContain(
    "require-trusted-types-for 'script'",
  );

  const element = page.locator("form-renderer");
  await expect(element.locator("[part=submit]")).toBeVisible();

  // The outer tree: the wrapper's own markup and its styles.
  await expect(element.locator(".title")).toHaveCSS("color", "rgb(10, 20, 30)");
  // A nested component, with a host custom property flowing in through the shadow boundary.
  await expect(element.locator(".value")).toHaveCSS("color", "rgb(200, 0, 100)");
  await expect(element.locator(".card")).toHaveCSS("border-top-color", "rgb(0, 100, 200)");
  // The host's `::part()` rule.
  await expect(element.locator("[part=submit]")).toHaveCSS("background-color", "rgb(255, 200, 0)");

  const shadowState = await element.evaluate((node) => ({
    adoptedSheets: node.shadowRoot?.adoptedStyleSheets.length,
    styleElements: node.shadowRoot?.querySelectorAll("style").length,
  }));
  expect(shadowState).toEqual({ adoptedSheets: 1, styleElements: 0 });

  expect(violations).toEqual([]);
  expect(problems).toEqual([]);
});
