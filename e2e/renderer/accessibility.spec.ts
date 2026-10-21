import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { seedProject } from "./projects.ts";

const ids = Array.from({ length: 7 }, () => randomUUID());

// One question of each of the seven types; two carry a description, which their controls must point at.
const questions = [
  {
    id: ids[0],
    type: "text",
    label: "Your name",
    required: true,
    config: { display: "single_line" },
  },
  {
    id: ids[1],
    type: "email",
    label: "Email",
    description: "We only use it to confirm your place.",
    required: true,
    config: {},
  },
  {
    id: ids[2],
    type: "number",
    label: "Guests",
    required: true,
    config: { integer: true, min: 1 },
  },
  { id: ids[3], type: "date", label: "Arrival date", required: true, config: {} },
  {
    id: ids[4],
    type: "single_choice",
    label: "Meal",
    description: "Tell the kitchen what to prepare.",
    required: true,
    config: {
      display: "radio",
      options: [
        { value: "veg", label: "Vegetarian" },
        { value: "fish", label: "Fish" },
      ],
    },
  },
  {
    id: ids[5],
    type: "multiple_choice",
    label: "Workshops",
    required: true,
    config: {
      options: [
        { value: "svelte", label: "Svelte" },
        { value: "zod", label: "Zod" },
      ],
    },
  },
  { id: ids[6], type: "boolean", label: "Need parking?", required: true, config: {} },
];

const openForm = async (page: Page, request: Parameters<typeof seedProject>[0]) => {
  const title = `Event sign-up ${randomUUID()}`;
  const seeded = await seedProject(request, [{ title, availability: "open", questions }]);
  await page.goto(`/projects/${seeded.projectId}`);
  const element = page.locator("form-renderer");
  await expect(element.getByRole("heading", { name: title })).toBeVisible();
  return { ...seeded, element };
};

const wcag22aa = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// axe walks open shadow roots, so a page scan covers the element's markup too.
const axeViolations = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page }).withTags(wcag22aa).analyze();
  return violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }));
};

test("axe finds no WCAG 2.2 AA violation while answering or showing errors", async ({
  page,
  request,
}) => {
  const { element } = await openForm(page, request);
  expect(await axeViolations(page)).toEqual([]);

  await element.getByRole("button", { name: "Submit" }).click();
  await expect(element.locator("[part=error]")).toHaveCount(questions.length);
  expect(await axeViolations(page)).toEqual([]);
});

test("a failed submit moves focus through the shadow root to the first error", async ({
  page,
  request,
}) => {
  const { element } = await openForm(page, request);
  const submit = element.getByRole("button", { name: "Submit" });
  // The id of the focused control inside the element, read from the document's side of the shadow boundary.
  const focusedInside = () =>
    page.evaluate(() => {
      const active = document.activeElement;
      return active?.localName === "form-renderer"
        ? (active.shadowRoot?.activeElement?.id ?? null)
        : null;
    });

  // The first question is answered, so the first error is the second one.
  await element.getByLabel("Your name").fill("Ada Lovelace");
  await submit.click();
  const email = element.getByLabel("Email");
  await expect(email).toBeFocused();
  expect(await focusedInside()).toBe(await email.getAttribute("id"));
  await expect(email).toHaveAttribute("aria-invalid", "true");
  const describedBy = (await email.getAttribute("aria-describedby"))?.split(" ") ?? [];
  expect(describedBy).toHaveLength(2);
  for (const id of describedBy) await expect(element.locator(`[id="${id}"]`)).toBeVisible();

  // An invalid radio group sends focus to its first radio.
  await email.fill("ada@example.com");
  await element.getByLabel("Guests").fill("3");
  await element.getByLabel("Arrival date").fill("2026-05-04");
  await element.getByRole("checkbox", { name: "Svelte" }).check();
  await element.getByRole("radio", { name: "No" }).check();
  await submit.click();
  const vegetarian = element.getByRole("radio", { name: "Vegetarian" });
  await expect(vegetarian).toBeFocused();
  expect(await focusedInside()).toBe(await vegetarian.getAttribute("id"));
});

test("a keyboard-only respondent fills in all seven types and submits", async ({
  page,
  request,
  browserName,
}) => {
  test.skip(
    browserName === "webkit",
    "WebKit's default Tab order (Safari without 'Press Tab to highlight each item') stops only at text fields: it " +
      "skips radios, checkboxes and the Submit button, so this run is Chromium and Firefox only.",
  );
  const { element, ids: formIds, api } = await openForm(page, request);
  const { keyboard } = page;
  const tabTo = async (target: ReturnType<typeof element.getByLabel>) => {
    await keyboard.press("Tab");
    await expect(target).toBeFocused();
  };

  const name = element.getByLabel("Your name");
  await tabTo(name);
  await keyboard.type("Ada");
  await tabTo(element.getByLabel("Email"));
  await keyboard.type("ada@example.com");
  // Back to the name to finish it, then forward again. Tabbing into a text field selects its text, so the right
  // arrow puts the caret after it.
  await keyboard.press("Shift+Tab");
  await expect(name).toBeFocused();
  await keyboard.press("ArrowRight");
  await keyboard.type(" Lovelace");
  await tabTo(element.getByLabel("Email"));
  await tabTo(element.getByLabel("Guests"));
  await keyboard.type("3");
  const date = element.getByLabel("Arrival date");
  await tabTo(date);
  // The segments' order follows the operating system's locale, not the browser context's, so day and month are
  // equal. Typing moves from segment to segment; Tab then walks the date's own remaining stops before it leaves.
  await keyboard.type("05052026");
  // Once a segment inside the date input has focus, Chromium no longer matches `:focus` on the input itself.
  const dateFocused = () =>
    date.evaluate((node) => {
      const root = node.getRootNode();
      return root instanceof ShadowRoot && root.activeElement === node;
    });
  for (let stops = 0; stops < 3 && (await dateFocused()); stops++) await keyboard.press("Tab");
  // The arrow keys move through a radio group and select as they go.
  await expect(element.getByRole("radio", { name: "Vegetarian" })).toBeFocused();
  await keyboard.press("ArrowDown");
  await expect(element.getByRole("radio", { name: "Fish" })).toBeChecked();
  await tabTo(element.getByRole("checkbox", { name: "Svelte" }));
  await keyboard.press("Space");
  await tabTo(element.getByRole("checkbox", { name: "Zod" }));
  await keyboard.press("Space");
  await tabTo(element.getByRole("radio", { name: "Yes" }));
  await keyboard.press("ArrowDown");
  await expect(element.getByRole("radio", { name: "No" })).toBeChecked();
  await tabTo(element.getByRole("button", { name: "Submit" }));
  const [submitted] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith(`/api/respond/forms/${formIds[0]}/responses`),
    ),
    keyboard.press("Enter"),
  ]);

  await expect(element.getByText("Thank you, your response was received.")).toBeVisible();
  expect(submitted.status()).toBe(201);
  const { responseId } = (await submitted.json()) as { responseId: string };
  const { response } = await api("GET", `/responses/${responseId}`);
  expect(response.answers).toEqual({
    [ids[0]!]: "Ada Lovelace",
    [ids[1]!]: "ada@example.com",
    [ids[2]!]: 3,
    [ids[3]!]: "2026-05-05",
    [ids[4]!]: "fish",
    [ids[5]!]: ["svelte", "zod"],
    [ids[6]!]: false,
  });
});
