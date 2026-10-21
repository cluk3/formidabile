import createClient, { type Client } from "openapi-fetch";
import type { components, paths } from "./lib/schema.d.ts";

/** The contract's schemas, such as `Schemas["FormSummary"]`. */
export type Schemas = components["schemas"];

export interface FormApiClientOptions {
  readonly baseUrl: string;
  readonly getToken: () => string | null | Promise<string | null>;
  readonly fetch?: (request: Request) => Promise<Response>;
}

export type FormApiClient = Client<paths>;

export const createFormApiClient = ({
  baseUrl,
  getToken,
  fetch,
}: FormApiClientOptions): FormApiClient => {
  const client = createClient<paths>({ baseUrl, fetch });
  client.use({
    async onRequest({ request }) {
      const token = await getToken();
      if (token !== null) request.headers.set("Authorization", `Bearer ${token}`);
      return request;
    },
  });
  return client;
};
