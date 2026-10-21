import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { createBuilderClient } from "#lib/api.ts";
import FormsPage from "#lib/FormsPage.svelte";

const config = {
  apiBaseUrl: "https://host.test/api",
  tokenUrl: "https://host.test/token",
  loginUrl: "https://host.test/login",
};

const base64Url = (value: object) =>
  btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");

// Only the claims the builder reads matter: the host signs the token and the API verifies it.
const adminToken = `${base64Url({ alg: "HS256" })}.${base64Url({ sub: "acme-admin", capabilities: ["forms:manage"] })}.signature`;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const summary = (title: string) => ({
  id: crypto.randomUUID(),
  title,
  availability: "open",
  responseLimit: "unlimited",
  currentVersion: null,
  hasDraft: true,
  updatedAt: "2026-10-21T08:00:00.000Z",
});

test("an unknown outcome on create says so and reloads the form list", async () => {
  const forms: ReturnType<typeof summary>[] = [];
  // The host commits the create, but the reply is lost to a proxy's 502.
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const route = `${request.method} ${new URL(request.url).pathname}`;
    if (route === "GET /token") return json(200, { token: adminToken });
    if (route === "GET /api/forms") return json(200, { forms });
    if (route === "POST /api/forms") {
      const { definition } = await request.json();
      forms.push(summary(definition.title));
      return new Response("Bad Gateway", { status: 502 });
    }
    return json(404, { _tag: "NotFound" });
  };
  const screen = await render(FormsPage, {
    client: createBuilderClient(config, fetch),
    signInHref: config.loginUrl,
  });
  await expect.element(screen.getByText("No forms yet")).toBeVisible();

  await screen.getByLabelText("Title").fill("Customer survey");
  await screen.getByRole("button", { name: "Create form" }).click();

  await expect.element(screen.getByText(/couldn.t confirm the form was created/i)).toBeVisible();
  await expect.element(screen.getByRole("listitem").getByText("Customer survey")).toBeVisible();
});
