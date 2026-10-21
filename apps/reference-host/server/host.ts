import type { FormModuleHandler } from "@fb/http-api/web";
import { type DevUser, devUsers, isDevUser, mintDevToken, mintFormToken } from "./dev-users.ts";
import {
  demoProjects,
  type ProjectForm,
  type ProjectFormCandidate,
  projectNamespace,
  projectTenant,
  resolveProjectForm,
} from "./projects.ts";

type Resolve = (tenant: string, projectId: string) => Promise<ProjectForm>;

/** The builder's `vp preview` origin, which calls `/api` and `/token` with credentials. */
export const builderOrigin = "http://localhost:4174";

const apiPrefix = "/api";
const sessionCookie = "dev-user";

export interface ReferenceHost {
  /** Whether `fetch` answers this path; everything else is the page and its assets. */
  readonly serves: (pathname: string) => boolean;
  readonly fetch: (request: Request) => Promise<Response>;
  readonly dispose: () => Promise<void>;
}

const isApiPath = (pathname: string) =>
  pathname === apiPrefix || pathname.startsWith(`${apiPrefix}/`);

// The module's routes have no prefix, so the mount point comes off before the handler sees the path.
const unmounted = (request: Request) => {
  const url = new URL(request.url);
  url.pathname = url.pathname.slice(apiPrefix.length) || "/";
  return new Request(url, request);
};

const signedInUser = (request: Request): DevUser | null => {
  for (const pair of request.headers.get("cookie")?.split(";") ?? []) {
    const [name, value] = pair.trim().split("=");
    if (name === sessionCookie && value !== undefined && isDevUser(value)) return value;
  }
  return null;
};

// Only this host's own paths and the builder are places to return to after signing in.
const safeReturn = (value: FormDataEntryValue | string | null) => {
  if (typeof value !== "string") return "/";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return value.startsWith(`${builderOrigin}/`) ? value : "/";
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

// Plain HTML with no inline style or script, so it renders under the preview's strict CSP.
const loginPage = (current: DevUser | null, returnTo: string) => {
  const choices = [...Object.keys(devUsers), "anonymous"]
    .map(
      (user) =>
        `<li><button name="user" value="${user}"${user === (current ?? "anonymous") ? " disabled" : ""}>${user}</button></li>`,
    )
    .join("");
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Sign in</title></head><body>` +
      `<h1>Sign in as a dev user</h1><p>Signed in as ${current ?? "anonymous"}.</p>` +
      `<form method="post" action="/login"><input type="hidden" name="return" value="${escapeHtml(returnTo)}">` +
      `<ul>${choices}</ul></form></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
};

const signIn = async (request: Request) => {
  const form = await request.formData();
  const user = form.get("user");
  const cookie =
    typeof user === "string" && isDevUser(user)
      ? `${sessionCookie}=${user}; Path=/; HttpOnly; SameSite=Lax`
      : `${sessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  return new Response(null, {
    status: 303,
    headers: { location: safeReturn(form.get("return")), "set-cookie": cookie },
  });
};

const json = (status: number, body: unknown) => Response.json(body, { status });

const html = (status: number, body: string) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });

const projectsPrefix = "/projects/";

// Like the sign-in page, the pages with no form are plain HTML with no inline style or script.
const staticPage = (status: number, heading: string, body: string) =>
  html(
    status,
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${heading}</title></head><body>` +
      `<main><h1>${heading}</h1>${body}</main></body></html>`,
  );

const noFormPage = () =>
  staticPage(404, "No open form for this project", "<p>Ask an admin to open one.</p>");

const ambiguousPage = (titles: ReadonlyArray<string>) =>
  staticPage(
    409,
    "This project has several open forms",
    `<p>Ask an admin to close or detach all but one:</p>` +
      `<ul>${titles.map((title) => `<li>${escapeHtml(title)}</li>`).join("")}</ul>`,
  );

// The element in the page's shell, which the page's script hands `/token?project=` as its `getToken`.
const element = `<form-renderer></form-renderer>`;

const formPage = (shell: string, form: ProjectFormCandidate, projectId: string) => {
  if (!shell.includes(element)) throw new Error(`The project page has no empty ${element}`);
  return html(
    200,
    shell.replace(
      element,
      `<form-renderer api-base-url="${apiPrefix}" form-id="${escapeHtml(form.id)}" ` +
        `data-project="${escapeHtml(projectId)}"></form-renderer>`,
    ),
  );
};

const projectPage = async (projectId: string, resolve: Resolve, shell: () => Promise<string>) => {
  const tenant = projectTenant(projectId);
  if (tenant === null) return noFormPage();
  const resolved = await resolve(tenant, projectId);
  if (resolved.kind === "none") return noFormPage();
  if (resolved.kind === "ambiguous") return ambiguousPage(resolved.forms.map(({ title }) => title));
  return formPage(await shell(), resolved.form, projectId);
};

// The admin page's shell holds this slot, which the host fills with a section per project the page manages.
const projectsSlot = `<div id="projects"></div>`;

const adminCapabilities = ["forms:manage", "responses:read"];

const isAdmin = (user: DevUser) => {
  const capabilities: ReadonlyArray<string> = devUsers[user].capabilities;
  return adminCapabilities.every((capability) => capabilities.includes(capability));
};

const demoProjectOf: Readonly<Record<string, string>> = demoProjects;

// Each section names the reference it manages; the page's script fills it in with the admin's token.
const projectSection = (projectId: string) => {
  const id = escapeHtml(projectId);
  return (
    `<section data-ref-namespace="${projectNamespace}" data-ref-id="${id}"><h2>Project ${id}</h2>` +
    `<p><a href="${projectsPrefix}${escapeHtml(encodeURIComponent(projectId))}">The project's form page</a></p></section>`
  );
};

// Without `?project=`, the admin manages their tenant's demo project; with it, any project in their tenant.
const adminPage = async (request: Request, url: URL, shell: () => Promise<string>) => {
  const user = signedInUser(request);
  if (user === null || !isAdmin(user)) {
    const signIn = `/login?return=${encodeURIComponent(url.pathname + url.search)}`;
    return staticPage(
      user === null ? 401 : 403,
      "Admins only",
      `<p><a href="${escapeHtml(signIn)}">Sign in as an admin</a></p>`,
    );
  }
  const { tenant } = devUsers[user];
  const requested = url.searchParams.get("project");
  if (requested !== null && projectTenant(requested) !== tenant)
    return staticPage(404, "No such project in your tenant", `<p>Signed in as ${user}.</p>`);
  const projects = requested === null ? [demoProjectOf[tenant]!] : [requested];
  const page = await shell();
  if (!page.includes(projectsSlot)) throw new Error(`The admin page has no empty ${projectsSlot}`);
  return html(
    200,
    // A replacer function, so a `$` in a project id is never read as a replacement pattern.
    page.replace(
      projectsSlot,
      () => `<div id="projects">${projects.map(projectSection).join("")}</div>`,
    ),
  );
};

// Without a project, a dev user gets a tenant-wide token; the anonymous user's grant needs the project's form.
const token = async (request: Request, project: string | null, resolve: Resolve) => {
  const user = signedInUser(request);
  if (project === null) {
    if (user === null) return json(401, { error: "Not signed in" });
    return json(200, { token: await mintDevToken(user) });
  }
  const tenant = projectTenant(project);
  if (tenant === null) return json(404, { error: "No such project" });
  if (user !== null && devUsers[user].tenant !== tenant)
    return json(403, { error: "This project is in another tenant" });
  const resolved = await resolve(tenant, project);
  if (resolved.kind !== "one") return json(404, { error: "No single open form for this project" });
  return json(200, {
    token: await mintFormToken(user, { tenant, id: resolved.form.id }, [
      { namespace: projectNamespace, refId: project },
    ]),
  });
};

// `/token` is read by the builder from its own origin with the cookie, so it answers that origin with credentials.
const withCors = (request: Request, response: Response) => {
  if (request.headers.get("origin") === builderOrigin) {
    response.headers.set("access-control-allow-origin", builderOrigin);
    response.headers.set("access-control-allow-credentials", "true");
  }
  response.headers.append("vary", "Origin");
  return response;
};

const projectIdOf = (pathname: string) => {
  try {
    return decodeURIComponent(pathname.slice(projectsPrefix.length));
  } catch {
    return "";
  }
};

export interface ReferenceHostOptions {
  /** The project page's HTML shell (`project.html`, as Vite serves it), holding an empty `<form-renderer>`. */
  readonly projectPage: () => Promise<string>;
  /** The admin page's HTML shell (`admin.html`, as Vite serves it), holding an empty `<div id="projects">`. */
  readonly adminPage: () => Promise<string>;
}

/**
 * The reference host's server routes: the module's API at `/api`, dev sign-in at `/login` and `/token`,
 * "the form for project X" at `/projects/<id>`, and the admin page for projects' references at `/admin`.
 */
export const createReferenceHost = (
  api: FormModuleHandler,
  options: ReferenceHostOptions,
): ReferenceHost => {
  // Migrated before the first API request rather than at startup, so `vp build` never opens the pool.
  let migrated: Promise<void> | undefined;
  const migrateOnce = () =>
    (migrated ??= api.migrate().catch((error: unknown) => {
      migrated = undefined;
      throw error;
    }));
  const resolve: Resolve = async (tenant, projectId) => {
    await migrateOnce();
    return resolveProjectForm(api.fetch, tenant, projectId);
  };
  return {
    serves: (pathname) =>
      isApiPath(pathname) ||
      pathname === "/login" ||
      pathname === "/token" ||
      pathname === "/admin" ||
      (pathname.startsWith(projectsPrefix) && pathname.length > projectsPrefix.length),
    fetch: async (request) => {
      const url = new URL(request.url);
      if (isApiPath(url.pathname)) {
        await migrateOnce();
        return api.fetch(unmounted(request));
      }
      const route = `${request.method} ${url.pathname}`;
      if (route === "GET /login")
        return loginPage(signedInUser(request), safeReturn(url.searchParams.get("return")));
      if (route === "POST /login") return signIn(request);
      if (route === "GET /token")
        return withCors(request, await token(request, url.searchParams.get("project"), resolve));
      if (route === "GET /admin") return adminPage(request, url, options.adminPage);
      if (request.method === "GET" && url.pathname.startsWith(projectsPrefix))
        return projectPage(projectIdOf(url.pathname), resolve, options.projectPage);
      return new Response(null, { status: 404 });
    },
    dispose: () => api.dispose(),
  };
};
