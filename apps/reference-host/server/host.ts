import type { FormModuleHandler } from "@fb/http-api/web";
import { type DevUser, devUsers, isDevUser, mintDevToken } from "./dev-users.ts";

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

// A grant for the anonymous user needs a `form`, which `/token` can't name until it takes a project.
const token = async (request: Request) => {
  const user = signedInUser(request);
  if (user === null) return json(401, { error: "Not signed in" });
  return json(200, { token: await mintDevToken(user) });
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

/** The reference host's server routes: the module's API at `/api`, and dev sign-in at `/login` and `/token`. */
export const createReferenceHost = (api: FormModuleHandler): ReferenceHost => ({
  serves: (pathname) => isApiPath(pathname) || pathname === "/login" || pathname === "/token",
  fetch: async (request) => {
    const url = new URL(request.url);
    if (isApiPath(url.pathname)) return api.fetch(unmounted(request));
    const route = `${request.method} ${url.pathname}`;
    if (route === "GET /login")
      return loginPage(signedInUser(request), safeReturn(url.searchParams.get("return")));
    if (route === "POST /login") return signIn(request);
    if (route === "GET /token") return withCors(request, await token(request));
    return new Response(null, { status: 404 });
  },
  dispose: () => api.dispose(),
});
