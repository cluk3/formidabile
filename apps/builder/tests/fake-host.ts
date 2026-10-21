export const config = {
  apiBaseUrl: "https://host.test/api",
  tokenUrl: "https://host.test/token",
  loginUrl: "https://host.test/login",
};

const base64Url = (value: object) =>
  btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");

// Only the claims the builder reads matter: the host signs the token and the API verifies it.
const adminToken = `${base64Url({ alg: "HS256" })}.${base64Url({ sub: "acme-admin", capabilities: ["forms:manage"] })}.signature`;

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * A `fetch` for `createBuilderClient` that answers the token endpoint with an admin's token and passes every API
 * request to `api` as `"<METHOD> <path under /api>"`.
 */
export const fakeHost =
  (api: (route: string, request: Request) => Response | Promise<Response>) =>
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/token") return json(200, { token: adminToken });
    return api(`${request.method} ${pathname.replace(/^\/api/, "")}`, request);
  };
