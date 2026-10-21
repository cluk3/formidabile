import { randomUUID } from "node:crypto";
import { type APIRequest, expect, type Page, test } from "@playwright/test";
import { seedProject } from "../renderer/projects.ts";

const referenceHost = "http://localhost:4173";

const name = {
  id: randomUUID(),
  type: "text",
  label: "Your name",
  required: true,
  config: { display: "single_line" },
};
const colour = {
  id: randomUUID(),
  type: "single_choice",
  label: "Favourite colour",
  required: true,
  config: {
    options: [
      { value: "red", label: "Red" },
      { value: "blue", label: "Blue" },
    ],
    display: "radio",
  },
};

/**
 * An open form of the test's own whose v1 asks a name and a colour, with alice's answers to v1, and a v2 that
 * relabels the name and drops the colour.
 */
const seedAnsweredForm = async (playwright: APIRequest) => {
  const admin = await playwright.newContext({ baseURL: referenceHost });
  const title = `Responses in e2e ${randomUUID()}`;
  const { projectId, ids, api } = await seedProject(admin, [
    { title, availability: "open", questions: [name, colour] },
  ]);
  const [formId] = ids as [string];
  const { currentVersion } = await api("GET", `/forms/${formId}`);

  const alice = await playwright.newContext({ baseURL: referenceHost });
  await alice.post("/login", { form: { user: "alice" } });
  const { token } = await (await alice.get(`/token?project=${projectId}`)).json();
  const submitted = await alice.post(`/api/respond/forms/${formId}/responses`, {
    headers: { authorization: `Bearer ${token}` },
    data: {
      versionId: currentVersion.id,
      answers: { [name.id]: "Ada", [colour.id]: "blue" },
      idempotencyKey: randomUUID(),
    },
  });
  expect(submitted.status()).toBe(201);

  const draft = await api("PUT", `/forms/${formId}/draft`, {
    expectedRevision: null,
    definition: { format: 1, title, questions: [{ ...name, label: "Your full name" }] },
  });
  await api("POST", `/forms/${formId}/draft/publish`, { expectedRevision: draft.revision });
  await Promise.all([admin.dispose(), alice.dispose()]);
  return { title, formId };
};

const signIn = async (page: Page, user: "acme-admin" | "acme-analyst") => {
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in" }).click();
  await page.getByRole("button", { name: user }).click();
};

/** From the form list to alice's response; returns its detail. */
const openAlicesResponse = async (page: Page, title: string) => {
  await page
    .getByRole("listitem")
    .filter({ hasText: title })
    .getByRole("link", { name: "Responses", exact: true })
    .click();
  const list = page.getByRole("list", { name: "Responses" });
  await list
    .getByRole("listitem")
    .filter({ hasText: "alice" })
    .getByRole("button", { name: "Open" })
    .click();
  const detail = page.getByRole("region", { name: "Response from alice" });
  await expect(detail).toBeVisible();
  return detail;
};

test("an admin opens a v1 response after v2 is published and sees v1's questions", async ({
  page,
  playwright,
}) => {
  const { title } = await seedAnsweredForm(playwright.request);
  await signIn(page, "acme-admin");

  const detail = await openAlicesResponse(page, title);

  await expect(detail.getByText(/^Version 1, submitted/)).toBeVisible();
  await expect(detail.getByText("Your name", { exact: true })).toBeVisible();
  await expect(detail.getByText("Ada", { exact: true })).toBeVisible();
  await expect(detail.getByText("Favourite colour", { exact: true })).toBeVisible();
  await expect(detail.getByText("Blue", { exact: true })).toBeVisible();
  await expect(detail.getByText("Your full name")).toHaveCount(0);
  await expect(detail.getByRole("button", { name: "Delete response" })).toBeVisible();
});

test("acme-analyst reads responses but can't publish or delete", async ({ page, playwright }) => {
  const { title, formId } = await seedAnsweredForm(playwright.request);
  await signIn(page, "acme-analyst");
  await expect(page.getByRole("listitem").filter({ hasText: title })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create form" })).toHaveCount(0);

  const detail = await openAlicesResponse(page, title);

  await expect(detail.getByText("Ada", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Delete/ })).toHaveCount(0);

  await page.getByRole("link", { name: "Edit form" }).click();
  await expect(page).toHaveURL(`/forms/${formId}`);
  await expect(page.getByText(/^Sign in as an admin who can manage forms\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0);
});
