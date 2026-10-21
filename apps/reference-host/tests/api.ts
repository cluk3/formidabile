import { createFormApiClient, type FormApiClient } from "@fb/api-client";
import { JwtActorResolver, toFormApiWebHandler } from "@fb/http-api";
import { declareLength } from "@fb/http-api/web";
import { DatabaseTest } from "@fb/server/testing";
import { Layer } from "effect";
import { type DevUser, devJwt, mintDevToken } from "../server/dev-users.ts";

/** The module's API on a fresh PGlite database, checking tokens with the dev secret, as the plugin's handler does. */
export const startApi = () =>
  toFormApiWebHandler(Layer.merge(JwtActorResolver(devJwt), DatabaseTest));

type Fetch = (request: Request) => Promise<Response>;

/** A client for the module's unprefixed routes, signed as a dev user. */
export const clientFor = (user: DevUser, fetch: Fetch) =>
  createFormApiClient({
    baseUrl: "http://localhost",
    getToken: () => mintDevToken(user),
    fetch: async (request) => fetch(await declareLength(request)),
  });

const readyId = "0192f5a0-7c3e-7b1a-9d2e-000000000001";

/** The one answer a `projectForm` takes. */
export const answers = { [readyId]: true };

/**
 * A form carrying the project's reference: a draft never published, or published and left closed or opened.
 * Returns the form's id and its published version's.
 */
export const projectForm = async (
  admin: FormApiClient,
  projectId: string,
  state: "unpublished" | "closed" | "open",
  title = `Form ${crypto.randomUUID()}`,
) => {
  const created = await admin.POST("/forms", {
    body: {
      definition: {
        format: 1,
        title,
        questions: [{ id: readyId, type: "boolean", label: "Ready?", required: true, config: {} }],
      },
    },
  });
  const { form, draft } = created.data!;
  await admin.POST("/forms/{formId}/external-refs", {
    params: { path: { formId: form.id } },
    body: { namespace: "project", refId: projectId },
  });
  if (state === "unpublished") return { id: form.id, title, versionId: null };
  const published = await admin.POST("/forms/{formId}/draft/publish", {
    params: { path: { formId: form.id } },
    body: { expectedRevision: draft.revision },
  });
  if (state === "open")
    await admin.PATCH("/forms/{formId}", {
      params: { path: { formId: form.id } },
      body: { availability: "open" },
    });
  return { id: form.id, title, versionId: published.data!.version.id };
};
