import { createFormApiClient } from "@fb/api-client";
import { declareLength } from "@fb/http-api/web";
import { jwtVerify } from "jose";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { builderOrigin, createReferenceHost } from "../server/host.ts";
import { clientFor, projectForm, startApi } from "./api.ts";

const origin = "http://localhost:4173";

const api = startApi();
// `DatabaseTest` is already migrated; the count shows the host asks once, before the API's first request.
let migrations = 0;
// The built `project.html`'s stand-in: the page's shell around the element the host fills in.
const projectPage = `<!doctype html><title>Project form</title><main><form-renderer></form-renderer></main>`;
// The built `admin.html`'s stand-in, around the slot the host fills with the admin's projects.
const adminPage = `<!doctype html><title>Admin</title><main><div id="projects"></div></main>`;
const host = createReferenceHost(
  {
    fetch: (request) => api.handler(request),
    migrate: async () => {
      migrations += 1;
    },
    dispose: api.dispose,
  },
  { projectPage: async () => projectPage, adminPage: async () => adminPage },
);

afterAll(() => host.dispose());

const signIn = async (user: string) => {
  const response = await host.fetch(
    new Request(`${origin}/login`, { method: "POST", body: new URLSearchParams({ user }) }),
  );
  expect(response.status).toBe(303);
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
};

const token = (cookie: string, headers: Record<string, string> = {}, query = "") =>
  host.fetch(new Request(`${origin}/token${query}`, { headers: { cookie, ...headers } }));

const verified = async (response: Response) => {
  const { token: minted } = (await response.json()) as { token: string };
  const { payload } = await jwtVerify(
    minted,
    new TextEncoder().encode("reference-host-dev-secret"),
    {
      issuer: "reference-host",
      audience: "form-module",
      algorithms: ["HS256"],
      requiredClaims: ["exp"],
    },
  );
  return payload;
};

const allCapabilities = ["forms:manage", "responses:read", "responses:delete"];

test.each([
  ["acme-admin", "acme", allCapabilities],
  ["acme-analyst", "acme", ["responses:read"]],
  ["globex-admin", "globex", allCapabilities],
  ["alice", "acme", []],
  ["bob", "acme", []],
])("/token mints %s a tenant-wide identified token", async (user, tenant, capabilities) => {
  const response = await token(await signIn(user));

  expect(response.status).toBe(200);
  expect(await verified(response)).toEqual({
    sub: user,
    tenant,
    capabilities,
    iss: "reference-host",
    aud: "form-module",
    iat: expect.any(Number),
    exp: expect.any(Number),
  });
});

test("/token gives 401 for the anonymous user, signed out or never signed in", async () => {
  await signIn("acme-admin");

  expect((await token(await signIn("anonymous"))).status).toBe(401);
  expect((await token("")).status).toBe(401);
});

test("an acme-admin token creates a form through /api", async () => {
  const cookie = await signIn("acme-admin");
  const client = createFormApiClient({
    baseUrl: `${origin}/api`,
    getToken: async () => ((await (await token(cookie)).json()) as { token: string }).token,
    fetch: async (request) => host.fetch(await declareLength(request)),
  });
  const definition = {
    format: 1 as const,
    title: "Through the host",
    questions: [
      {
        id: crypto.randomUUID(),
        type: "boolean" as const,
        label: "Ready?",
        required: true,
        config: {},
      },
    ],
  };

  expect(migrations).toBe(0);
  const created = await client.POST("/forms", { body: { definition } });
  const listed = await client.GET("/forms");

  expect(migrations).toBe(1);
  expect(created.response.status).toBe(201);
  expect(listed.data?.forms.map((form) => form.id)).toContain(created.data?.form.id);
});

test("/token answers the builder's origin with credentials", async () => {
  const response = await token(await signIn("acme-admin"), { origin: builderOrigin });

  expect(response.headers.get("access-control-allow-origin")).toBe(builderOrigin);
  expect(response.headers.get("access-control-allow-credentials")).toBe("true");
});

describe("/token?project=", () => {
  const admin = clientFor("acme-admin", (request) => api.handler(request));
  const newProject = () => `acme-${crypto.randomUUID()}`;
  const projectToken = (cookie: string, projectId: string) =>
    token(cookie, {}, `?project=${encodeURIComponent(projectId)}`);

  test.each([["acme-admin"], ["acme-analyst"], ["alice"], ["bob"]])(
    "mints %s an identified token bound to the project's one open form, carrying its reference",
    async (user) => {
      const projectId = newProject();
      const form = await projectForm(admin, projectId, "open");
      await projectForm(admin, projectId, "closed");

      const response = await projectToken(await signIn(user), projectId);

      expect(response.status).toBe(200);
      expect(await verified(response)).toEqual({
        sub: user,
        tenant: "acme",
        capabilities: expect.any(Array),
        form: form.id,
        refs: [{ namespace: "project", refId: projectId }],
        iss: "reference-host",
        aud: "form-module",
        iat: expect.any(Number),
        exp: expect.any(Number),
      });
    },
  );

  test("mints the anonymous user a grant in the project's tenant that expires after 5 minutes", async () => {
    const projectId = newProject();
    const form = await projectForm(admin, projectId, "open");

    const response = await projectToken("", projectId);

    expect(response.status).toBe(200);
    const payload = await verified(response);
    expect(payload).toEqual({
      anonymous: true,
      tenant: "acme",
      form: form.id,
      refs: [{ namespace: "project", refId: projectId }],
      iss: "reference-host",
      aud: "form-module",
      iat: expect.any(Number),
      exp: expect.any(Number),
    });
    expect(payload.exp! - payload.iat!).toBe(5 * 60);
  });

  test.each<[string, ReadonlyArray<"unpublished" | "closed" | "open">]>([
    ["no open form", ["unpublished", "closed"]],
    ["several open forms", ["open", "open"]],
  ])("gives 404 for a project with %s", async (_, states) => {
    const projectId = newProject();
    for (const state of states) await projectForm(admin, projectId, state);

    expect((await projectToken(await signIn("alice"), projectId)).status).toBe(404);
    expect((await projectToken("", projectId)).status).toBe(404);
  });

  test("refuses a project in another tenant", async () => {
    const projectId = newProject();
    await projectForm(admin, projectId, "open");

    expect((await projectToken(await signIn("globex-admin"), projectId)).status).toBe(403);
  });

  test("gives 404 for an id that names no dev tenant or is longer than a reference holds", async () => {
    expect((await projectToken(await signIn("alice"), "initech-launch")).status).toBe(404);
    expect((await projectToken("", `acme-${"x".repeat(251)}`)).status).toBe(404);
  });
});

describe("/projects/<id>", () => {
  const admin = clientFor("acme-admin", (request) => api.handler(request));
  const page = async (projectId: string) => {
    const response = await host.fetch(
      new Request(`${origin}/projects/${encodeURIComponent(projectId)}`),
    );
    return { status: response.status, html: await response.text() };
  };

  test("mounts the element for the project's one open form, in the page's shell", async () => {
    const suffix = crypto.randomUUID();
    const projectId = `acme-${suffix}&"more"`;
    const form = await projectForm(admin, projectId, "open");
    await projectForm(admin, projectId, "closed");

    const { status, html } = await page(projectId);

    expect(status).toBe(200);
    expect(html).toBe(
      `<!doctype html><title>Project form</title><main>` +
        `<form-renderer api-base-url="/api" form-id="${form.id}" ` +
        `data-project="acme-${suffix}&#38;&#34;more&#34;"></form-renderer></main>`,
    );
  });

  test("copies a project id with replacement patterns into the page as written", async () => {
    const suffix = crypto.randomUUID();
    const projectId = `acme-${suffix}-$'$&$$`;
    const form = await projectForm(admin, projectId, "open");

    const { html } = await page(projectId);

    expect(html).toBe(
      `<!doctype html><title>Project form</title><main>` +
        `<form-renderer api-base-url="/api" form-id="${form.id}" ` +
        `data-project="acme-${suffix}-$&#39;$&#38;$$"></form-renderer></main>`,
    );
  });

  test("shows a static page with no element when the project has no open form", async () => {
    const projectId = `acme-${crypto.randomUUID()}`;
    await projectForm(admin, projectId, "closed");

    const { status, html } = await page(projectId);

    expect(status).toBe(404);
    expect(html).toContain("No open form for this project");
    expect(html).not.toContain("form-renderer");
    expect(html).not.toContain("<script");
  });

  test("lists the candidates' titles with no element when several forms are open", async () => {
    const projectId = `acme-${crypto.randomUUID()}`;
    await projectForm(admin, projectId, "open", "First <open> form");
    await projectForm(admin, projectId, "open", "Second open form");

    const { status, html } = await page(projectId);

    expect(status).toBe(409);
    expect(html).toContain("<li>First &#60;open&#62; form</li>");
    expect(html).toContain("<li>Second open form</li>");
    expect(html).not.toContain("form-renderer");
    expect(html).not.toContain("<script");
  });

  test("shows the no-form page for an id that names no dev tenant", async () => {
    const { status, html } = await page("initech-launch");

    expect(status).toBe(404);
    expect(html).toContain("No open form for this project");
  });
});

describe("/admin", () => {
  const page = async (cookie: string, query = "") => {
    const response = await host.fetch(
      new Request(`${origin}/admin${query}`, { headers: { cookie } }),
    );
    return { status: response.status, html: await response.text() };
  };
  const section = (projectId: string, escaped = projectId) =>
    `<section data-ref-namespace="project" data-ref-id="${escaped}" aria-labelledby="project-0">` +
    `<h2 id="project-0">Project ${escaped}</h2>` +
    `<p><a href="/projects/${encodeURIComponent(projectId)}">The project's form page</a></p></section>`;

  test.each([
    ["acme-admin", "acme-spring-orders"],
    ["globex-admin", "globex-partner-summit"],
  ])("shows %s their tenant's demo project, in the page's shell", async (user, projectId) => {
    const { status, html } = await page(await signIn(user));

    expect(status).toBe(200);
    expect(html).toBe(
      `<!doctype html><title>Admin</title><main><div id="projects">${section(projectId)}</div></main>`,
    );
  });

  test("shows only the project it's asked for, in the admin's tenant", async () => {
    const projectId = `acme-${crypto.randomUUID()}&"more"`;

    const { status, html } = await page(
      await signIn("acme-admin"),
      `?project=${encodeURIComponent(projectId)}`,
    );

    expect(status).toBe(200);
    expect(html).toContain(
      `<div id="projects">${section(projectId, projectId.replace('&"more"', "&#38;&#34;more&#34;"))}</div>`,
    );
  });

  test.each([
    ["in another tenant", "globex-partner-summit"],
    ["that names no dev tenant", "initech-launch"],
  ])("shows a static page for a project %s", async (_, projectId) => {
    const { status, html } = await page(await signIn("acme-admin"), `?project=${projectId}`);

    expect(status).toBe(404);
    expect(html).toContain("No such project in your tenant");
    expect(html).not.toContain("<section");
    expect(html).not.toContain("<script");
  });

  test("asks the anonymous user to sign in as an admin", async () => {
    const { status, html } = await page(await signIn("anonymous"));

    expect(status).toBe(401);
    expect(html).toContain(`<a href="/login?return=%2Fadmin">Sign in as an admin</a>`);
    expect(html).not.toContain("<script");
  });

  test.each([["acme-analyst"], ["alice"]])("refuses %s, who can't manage forms", async (user) => {
    const { status, html } = await page(await signIn(user), "?project=acme-spring-orders");

    expect(status).toBe(403);
    expect(html).toContain(
      `<a href="/login?return=%2Fadmin%3Fproject%3Dacme-spring-orders">Sign in as an admin</a>`,
    );
    expect(html).not.toContain("<section");
  });
});
