import { randomUUID } from "node:crypto";
import { type APIRequestContext, expect } from "@playwright/test";

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
  }>,
) => {
  const projectId = `acme-e2e-${randomUUID()}`;
  await request.post("/login", { form: { user: "acme-admin" } });
  const { token } = (await (await request.get("/token")).json()) as { token: string };
  const api = async (method: "GET" | "POST" | "PATCH", path: string, data?: unknown) => {
    const response = await request.fetch(`/api${path}`, {
      method,
      data,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.ok(), `${method} ${path}`).toBe(true);
    return response.json();
  };
  const ids: string[] = [];
  for (const { title, availability, questions = [readyQuestion()] } of forms) {
    const { form, draft } = await api("POST", "/forms", {
      definition: { format: 1, title, questions },
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
