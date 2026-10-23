import { randomUUID } from "node:crypto";
import { type APIRequestContext, expect, type Page } from "@playwright/test";

const readyQuestion = () => ({
  id: randomUUID(),
  type: "boolean",
  label: "Ready?",
  required: true,
  config: {},
});

/**
 * Seeds a project of the test's own through the host, signed in as `acme-admin`: each form carries the project's
 * reference, and is published and opened or left closed. A form without `questions` asks one required boolean.
 * `api` keeps calling the module as that admin.
 */
export const seedProject = async (
  request: APIRequestContext,
  forms: ReadonlyArray<{
    readonly title: string;
    readonly availability: "open" | "closed";
    readonly questions?: ReadonlyArray<object>;
    /** Posted as the definition when a test needs pages. Otherwise a format-1 list of `questions`. */
    readonly definition?: object;
  }>,
) => {
  const projectId = `acme-e2e-${randomUUID()}`;
  await request.post("/login", { form: { user: "acme-admin" } });
  const { token } = (await (await request.get("/token")).json()) as { token: string };
  const api = async (method: "GET" | "POST" | "PUT" | "PATCH", path: string, data?: unknown) => {
    const response = await request.fetch(`/api${path}`, {
      method,
      data,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.ok(), `${method} ${path}`).toBe(true);
    return response.json();
  };
  const ids: string[] = [];
  for (const { title, availability, questions = [readyQuestion()], definition } of forms) {
    const { form, draft } = await api("POST", "/forms", {
      definition: definition ?? { format: 1, title, questions },
    });
    await api("POST", `/forms/${form.id}/external-refs`, {
      namespace: "project",
      refId: projectId,
    });
    await api("POST", `/forms/${form.id}/draft/publish`, { expectedRevision: draft.revision });
    if (availability === "open") await api("PATCH", `/forms/${form.id}`, { availability });
    ids.push(form.id);
  }
  return { projectId, ids, api };
};

/**
 * Signs the page in as a dev admin through the host's sign-in page and opens the admin page for a project. Returns
 * the project's section once its forms have loaded.
 */
export const openAdminPage = async (
  page: Page,
  projectId: string,
  user: "acme-admin" | "globex-admin" = "acme-admin",
) => {
  await page.goto(`/login?return=${encodeURIComponent(`/admin?project=${projectId}`)}`);
  await page.getByRole("button", { name: user }).click();
  const section = page.getByRole("region", { name: `Project ${projectId}` });
  await expect(section.getByRole("heading", { name: "Forms with this project" })).toBeVisible();
  return section;
};
