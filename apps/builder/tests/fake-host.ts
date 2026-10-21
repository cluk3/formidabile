export const config = {
  apiBaseUrl: "https://host.test/api",
  tokenUrl: "https://host.test/token",
  loginUrl: "https://host.test/login",
};

const base64Url = (value: object) =>
  btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");

// Only the claims the builder reads matter: the host signs the token and the API verifies it.
const tokenWith = (capabilities: ReadonlyArray<string>) =>
  `${base64Url({ alg: "HS256" })}.${base64Url({ sub: "acme-admin", capabilities })}.signature`;

export const admin = ["forms:manage", "responses:read", "responses:delete"];
export const analyst = ["responses:read"];

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * A `fetch` for `createBuilderClient` that answers the token endpoint with a token carrying `capabilities` (an
 * admin's by default) and passes every API request to `api` as `"<METHOD> <path under /api>"`.
 */
export const fakeHost =
  (
    api: (route: string, request: Request) => Response | Promise<Response>,
    capabilities: ReadonlyArray<string> = admin,
  ) =>
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/token") {
      return json(200, { token: tokenWith(capabilities) });
    }
    return api(`${request.method} ${pathname.replace(/^\/api/, "")}`, request);
  };
