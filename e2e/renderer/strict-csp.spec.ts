import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { seedProject } from "./projects.ts";

// The reference host serves its pages under the strict CSP from ADR 0008 in `vp preview`. The element must render
// fully styled with no violation, from the outer tree, from a nested component, and through the host's theming.
test("the element renders styled under a strict CSP with no violations", async ({
  page,
  request,
}) => {
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

  const { projectId } = await seedProject(request, [
    { title: `Styled form ${randomUUID()}`, availability: "open" },
  ]);
  const response = await page.goto(`/projects/${projectId}`);
  expect(response?.headers()["content-security-policy"]).toContain(
    "require-trusted-types-for 'script'",
  );

  const element = page.locator("form-renderer");
  await expect(element.locator("[part=submit]")).toBeVisible();

  // The outer tree: the renderer's own markup and its styles.
  await expect(element.locator(".title")).toHaveCSS("color", "rgb(10, 20, 30)");
  // Nested components, with host custom properties flowing in through the shadow boundary.
  await expect(element.locator(".required")).toHaveCSS("color", "rgb(200, 0, 100)");
  await expect(element.locator("[part=question]")).toHaveCSS(
    "border-top-color",
    "rgb(0, 100, 200)",
  );
  // The host's `::part()` rule.
  await expect(element.locator("[part=submit]")).toHaveCSS("background-color", "rgb(255, 200, 0)");

  const shadowState = await element.evaluate((node) => ({
    adoptedSheets: node.shadowRoot?.adoptedStyleSheets.length,
    styleElements: node.shadowRoot?.querySelectorAll("style").length,
  }));
  expect(shadowState).toEqual({ adoptedSheets: 1, styleElements: 0 });

  // The states a respondent reaches later render under the same policy: errors, then the confirmation.
  await element.locator("[part=submit]").click();
  await expect(element.locator("[part=error]")).toHaveCSS("color", "rgb(180, 20, 20)");
  await element.getByRole("radio", { name: "Yes" }).check();
  await element.locator("[part=submit]").click();
  await expect(element.getByText("Thank you, your response was received.")).toBeVisible();

  expect(violations).toEqual([]);
  expect(problems).toEqual([]);
});
