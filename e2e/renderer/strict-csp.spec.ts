import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { pagedDefinition } from "./paged-form.ts";
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

// ADR 0017: a form is pages, and the element tells the host about each one instead of touching the host's document.
// This walks a paged form that uses every input the iteration added, under the same policy, in all three browsers.
test("a paged form with every new input renders and submits under a strict CSP", async ({
  page,
  request,
}) => {
  const problems: string[] = [];
  const violations: string[] = [];
  await page.exposeFunction("reportViolation", (description: string) => {
    violations.push(description);
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      Reflect.get(window, "reportViolation")(`${event.violatedDirective}: ${event.blockedURI}`);
    });
  });
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));

  const title = `Paged form ${randomUUID()}`;
  const { ids, definition } = pagedDefinition(title);
  const seeded = await seedProject(request, [{ title, availability: "open", definition }]);
  const response = await page.goto(`/projects/${seeded.projectId}`);
  expect(response?.headers()["content-security-policy"]).toContain(
    "require-trusted-types-for 'script'",
  );

  const element = page.locator("form-renderer");
  await expect(element.getByRole("heading", { name: "How to reach you" })).toBeFocused();

  // The element ships no static `style` attribute and no script, and it leaves the host's document alone.
  const hostState = () =>
    page.evaluate(() => ({
      title: document.title,
      url: location.href,
      history: history.length,
    }));
  const before = await hostState();
  const staticMarkup = () =>
    element.evaluate((node) => node.shadowRoot?.querySelectorAll("script, [style]").length);
  const next = async (heading: string) => {
    expect(await staticMarkup()).toBe(0);
    await element.getByRole("button", { name: "Next" }).click();
    await expect(element.getByRole("heading", { name: heading })).toBeFocused();
  };

  await element.getByLabel("Phone number").fill("+14155550100");
  await element.getByLabel("Your website").fill("https://example.com/");
  await element.getByLabel("Address line 1").fill("1 High Street");
  await element.getByLabel("City").fill("Leeds");
  await next("When you travel");

  await element.getByLabel("Departure").fill("09:30");
  await element.getByLabel("Check-in").fill("2026-05-04T14:00");
  await element.getByLabel("From").fill("2026-05-04");
  await element.getByLabel("To").fill("2026-05-07");
  await next("What you prefer");

  for (const name of ["Museum", "Hike", "Beach"])
    await element.getByRole("button", { name: `Add ${name}` }).click();
  await element.getByRole("radio", { name: "Speed, Good" }).check();
  await element.getByRole("checkbox", { name: "Price, Poor" }).check();
  await element.getByRole("checkbox", { name: "Price, Good" }).check();
  await next("How it went");

  await element.getByLabel("4 stars").check();
  await element
    .getByRole("radiogroup", { name: "How comfortable was the bed?" })
    .getByLabel("6", { exact: true })
    .check();
  await element.getByLabel("Your budget").fill("40");
  await element
    .getByRole("radiogroup", { name: "Would you recommend us?" })
    .getByLabel("9", { exact: true })
    .check();
  await next("Before you send");

  // The checkbox is the only answer this page accepts: unticked, it is unanswered.
  await element.getByRole("button", { name: "Submit" }).click();
  await expect(element.locator("[part=error]")).toHaveCSS("color", "rgb(180, 20, 20)");
  await element.getByRole("checkbox", { name: "I accept the terms" }).check();
  const [submitted] = await Promise.all([
    page.waitForResponse(
      (reply) => reply.request().method() === "POST" && reply.url().endsWith("/responses"),
    ),
    element.getByRole("button", { name: "Submit" }).click(),
  ]);
  await expect(element.getByText("Thank you, your response was received.")).toBeVisible();
  expect(submitted.status()).toBe(201);
  expect(await staticMarkup()).toBe(0);
  expect(await hostState()).toEqual(before);

  const { responseId } = (await submitted.json()) as { responseId: string };
  const { response: stored } = await seeded.api("GET", `/responses/${responseId}`);
  expect(stored.answers).toEqual({
    [ids.phone]: "+14155550100",
    [ids.url]: "https://example.com/",
    [ids.address]: { line1: "1 High Street", city: "Leeds" },
    [ids.timeOfDay]: "09:30",
    [ids.dateTime]: "2026-05-04T14:00",
    [ids.dateRange]: { start: "2026-05-04", end: "2026-05-07" },
    [ids.ranking]: ["museum", "hike", "beach"],
    [ids.singleMatrix]: { speed: "good" },
    [ids.multipleMatrix]: { price: ["poor", "good"] },
    [ids.rating]: 4,
    [ids.scale]: 6,
    [ids.slider]: 40,
    [ids.nps]: 9,
    [ids.consent]: true,
  });

  expect(violations).toEqual([]);
  expect(problems).toEqual([]);
});
