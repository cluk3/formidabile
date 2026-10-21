import { randomUUID } from "node:crypto";
import { type APIRequestContext, expect, test } from "@playwright/test";

// Seeds a project of the test's own through the host, signed in as `acme-admin`: each form carries the project's
// reference, and is published and opened or left closed.
const seedProject = async (
  request: APIRequestContext,
  forms: ReadonlyArray<{ readonly title: string; readonly availability: "open" | "closed" }>,
) => {
  const projectId = `acme-e2e-${randomUUID()}`;
  await request.post("/login", { form: { user: "acme-admin" } });
  const { token } = (await (await request.get("/token")).json()) as { token: string };
  const api = async (method: "POST" | "PATCH", path: string, data: unknown) => {
    const response = await request.fetch(`/api${path}`, {
      method,
      data,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.ok(), `${method} ${path}`).toBe(true);
    return response.json();
  };
  const ids: string[] = [];
  for (const { title, availability } of forms) {
    const { form, draft } = await api("POST", "/forms", {
      definition: {
        format: 1,
        title,
        questions: [
          { id: randomUUID(), type: "boolean", label: "Ready?", required: true, config: {} },
        ],
      },
    });
    await api("POST", `/forms/${form.id}/external-refs`, {
      namespace: "project",
      refId: projectId,
    });
    await api("POST", `/forms/${form.id}/draft/publish`, { expectedRevision: draft.revision });
    if (availability === "open") await api("PATCH", `/forms/${form.id}`, { availability });
    ids.push(form.id);
  }
  return { projectId, ids };
};

test("the form for project X mounts the element for the project's one open form", async ({
  page,
  request,
}) => {
  const title = `Project form ${randomUUID()}`;
  const { projectId, ids } = await seedProject(request, [
    { title, availability: "open" },
    { title: `Old form ${randomUUID()}`, availability: "closed" },
  ]);

  await page.goto(`/projects/${projectId}`);

  const element = page.locator("form-renderer");
  await expect(element).toHaveAttribute("form-id", ids[0]!);
  await expect(element.locator(".title")).toHaveText(title);
});

test("a project with no open form shows a static page and mounts no element", async ({
  page,
  request,
}) => {
  const { projectId } = await seedProject(request, [
    { title: `Closed form ${randomUUID()}`, availability: "closed" },
  ]);

  await page.goto(`/projects/${projectId}`);

  await expect(page.getByRole("heading", { name: "No open form for this project" })).toBeVisible();
  await expect(page.locator("form-renderer")).toHaveCount(0);
});

test("a project with several open forms lists their titles and mounts no element", async ({
  page,
  request,
}) => {
  const titles = [`First open form ${randomUUID()}`, `Second open form ${randomUUID()}`];
  const { projectId } = await seedProject(
    request,
    titles.map((title) => ({ title, availability: "open" as const })),
  );

  await page.goto(`/projects/${projectId}`);

  await expect(
    page.getByRole("heading", { name: "This project has several open forms" }),
  ).toBeVisible();
  for (const title of titles)
    await expect(page.getByRole("listitem").filter({ hasText: title })).toBeVisible();
  await expect(page.locator("form-renderer")).toHaveCount(0);
});
