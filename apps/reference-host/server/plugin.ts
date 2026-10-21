import { createFormModuleHandler } from "@fb/http-api/web";
import { createRequest, sendResponse } from "@remix-run/node-fetch-server";
import type { Connect, Plugin } from "vite-plus";
import { devJwt } from "./dev-users.ts";
import { builderOrigin, createReferenceHost, type ReferenceHost } from "./host.ts";

// What a host that enforces a strict CSP allows (ADR 0008): the bundle's own origin and nothing inline.
// `svelte-trusted-html` is the fixed name of the Trusted Types policy Svelte creates when it loads.
const strictContentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "require-trusted-types-for 'script'",
  "trusted-types svelte-trusted-html",
].join("; ");

const composeDatabaseUrl = "postgres://formidabile:formidabile@localhost:5432/formidabile";

const hostMiddleware = (host: ReferenceHost): Connect.NextHandleFunction => {
  return (req, res, next) => {
    // Everything the host doesn't serve falls through, so Vite keeps serving the page and its assets.
    if (!host.serves(new URL(req.url ?? "/", "http://host").pathname)) return next();
    // `createRequest` and `sendResponse` run inside the middleware, never ahead of the path check.
    host
      .fetch(createRequest(req, res))
      .then((response) => sendResponse(res, response))
      .catch(next);
  };
};

const contentSecurityPolicyMiddleware: Connect.NextHandleFunction = (_req, res, next) => {
  res.setHeader("Content-Security-Policy", strictContentSecurityPolicy);
  next();
};

/**
 * Serves the form module's API at `/api/*` and dev sign-in at `/login` and `/token`, in `vp dev` and `vp preview`,
 * and the strict CSP in `vp preview`.
 */
export const referenceHost = (): Plugin => {
  const host = createReferenceHost(
    createFormModuleHandler({
      databaseUrl: process.env.DATABASE_URL ?? composeDatabaseUrl,
      jwt: devJwt,
      cors: [builderOrigin],
    }),
  );
  return {
    name: "reference-host",
    configureServer(server) {
      // No CSP in dev: the dev server injects CSS as <style> elements, which a strict `style-src` blocks.
      server.middlewares.use(hostMiddleware(host));
      server.httpServer?.once("close", () => void host.dispose());
    },
    configurePreviewServer(server) {
      server.middlewares.use(contentSecurityPolicyMiddleware);
      server.middlewares.use(hostMiddleware(host));
      server.httpServer.once("close", () => void host.dispose());
    },
  };
};
