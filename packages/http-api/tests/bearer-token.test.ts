import { createFormApiClient, type FormApiClientOptions } from "@fb/api-client";
import { createFormModuleHandler } from "@fb/http-api/web";
import { afterAll, afterEach, expect, test } from "vite-plus/test";
import { baseUrl, jwt } from "./api.ts";

// Every request here is refused before the handler reaches the database.
const handler = createFormModuleHandler({ databaseUrl: "postgres://localhost/unused", jwt });
const authorizationHeaders: Array<string | null> = [];

const clientWith = (getToken: FormApiClientOptions["getToken"]) =>
  createFormApiClient({
    baseUrl,
    getToken,
    fetch: (request) => {
      authorizationHeaders.push(request.headers.get("authorization"));
      return handler.fetch(request);
    },
  });

afterEach(() => {
  authorizationHeaders.length = 0;
});

afterAll(() => handler.dispose());

test("the client asks getToken before every request and sends the result as a bearer token", async () => {
  let calls = 0;
  const client = clientWith(async () => `token-${++calls}`);

  await client.GET("/forms");
  await client.GET("/forms");

  expect(authorizationHeaders).toEqual(["Bearer token-1", "Bearer token-2"]);
});

test("the client sends no authorization header when getToken returns null", async () => {
  const client = clientWith(() => null);

  await client.GET("/forms");

  expect(authorizationHeaders).toEqual([null]);
});
