import { createFormApiClient, type FormApiClient } from "@fb/api-client";
import type { BuilderConfig } from "#lib/config.ts";

/** The host gave no token (401), or one without `forms:manage`: only signing in again helps. */
class SignInRequired extends Error {}

/** The token endpoint failed some other way, so the API call was never sent. */
class TokenUnavailable extends Error {}

const capabilitiesOf = (token: string): unknown => {
  try {
    const payload = token.split(".")[1] ?? "";
    const json = atob(payload.replaceAll("-", "+").replaceAll("_", "/"));
    const claims: unknown = JSON.parse(json);
    return typeof claims === "object" && claims !== null
      ? Reflect.get(claims, "capabilities")
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The API client for the signed-in admin. Before each call it asks the host's `tokenUrl`, with the host's cookie,
 * for a fresh token. The builder only reads the token's claims to decide whether to ask for a sign-in; the API
 * verifies it.
 */
export const createBuilderClient = (
  config: BuilderConfig,
  fetch: typeof globalThis.fetch = globalThis.fetch,
): FormApiClient =>
  createFormApiClient({
    baseUrl: config.apiBaseUrl,
    fetch: (request) => fetch(request),
    getToken: async () => {
      const response = await fetch(config.tokenUrl, { credentials: "include" }).catch(() => {
        throw new TokenUnavailable();
      });
      if (response.status === 401) throw new SignInRequired();
      const body: unknown = response.ok ? await response.json().catch(() => undefined) : undefined;
      const token =
        typeof body === "object" && body !== null ? Reflect.get(body, "token") : undefined;
      if (typeof token !== "string") throw new TokenUnavailable();
      const capabilities = capabilitiesOf(token);
      if (!Array.isArray(capabilities) || !capabilities.includes("forms:manage")) {
        throw new SignInRequired();
      }
      return token;
    },
  });

/** The host's sign-in page, returning to `returnTo` afterwards. */
export const signInUrl = (loginUrl: string, returnTo: string): string => {
  const url = new URL(loginUrl, returnTo);
  url.searchParams.set("return", returnTo);
  return url.href;
};

/**
 * What became of an API call (ADR 0016). Only a tagged 4xx is a definite refusal. A rejected `fetch`, a 5xx or a
 * reply outside the contract is `unknown`: a write may have committed, so the caller says it couldn't confirm the
 * action and reloads what it affected (the form list after a create, the form's detail otherwise). `tooLarge` is the
 * edge's 413: the body was refused before any of it was read.
 */
export type Outcome<T, E> =
  | { readonly kind: "ok"; readonly data: T }
  | { readonly kind: "rejected"; readonly error: E }
  | { readonly kind: "tooLarge" }
  | { readonly kind: "signIn" }
  | { readonly kind: "tokenUnavailable" }
  | { readonly kind: "unknown" };

/** An `openapi-fetch` result: `data` on a 2xx, `error` otherwise. */
type FetchResult = { data?: unknown; error?: unknown; response: Response };

const isTagged = (value: unknown): value is { _tag: string } =>
  typeof value === "object" && value !== null && typeof Reflect.get(value, "_tag") === "string";

export const outcome = async <R extends FetchResult>(
  call: () => Promise<R>,
): Promise<Outcome<NonNullable<R["data"]>, NonNullable<R["error"]>>> => {
  let result: R;
  try {
    result = await call();
  } catch (error) {
    if (error instanceof SignInRequired) return { kind: "signIn" };
    if (error instanceof TokenUnavailable) return { kind: "tokenUnavailable" };
    return { kind: "unknown" };
  }
  const { data, error, response }: { data?: R["data"]; error?: R["error"]; response: Response } =
    result;
  // Only endpoints whose contract declares no body answer 204, so their `data` type is empty too.
  if (response.status === 204) return { kind: "ok", data: data as NonNullable<R["data"]> };
  if (response.ok) {
    return typeof data === "object" && data !== null ? { kind: "ok", data } : { kind: "unknown" };
  }
  if (response.status === 401) return { kind: "signIn" };
  if (response.status === 413) return { kind: "tooLarge" };
  if (response.status >= 500 || !isTagged(error)) return { kind: "unknown" };
  if (error._tag === "Forbidden" && Reflect.get(error, "capability") === "forms:manage") {
    return { kind: "signIn" };
  }
  return { kind: "rejected", error };
};
