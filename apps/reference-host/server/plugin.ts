import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createFormModuleHandler } from "@fb/http-api/web";
import { createRequest, sendResponse } from "@remix-run/node-fetch-server";
import type { Connect, Plugin, ResolvedConfig } from "vite-plus";
import { databaseUrl } from "./database-url.ts";
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

/** The project page's shell, an entry of its own beside `index.html`. */
export const projectPageFile = "project.html";

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

const createHost = (projectPage: () => Promise<string>) =>
  createReferenceHost(
    createFormModuleHandler({
      databaseUrl,
      jwt: devJwt,
      cors: [builderOrigin],
    }),
    { projectPage },
  );

/**
 * Serves the form module's API at `/api/*`, dev sign-in at `/login` and `/token`, and the project page at
 * `/projects/<id>`, in `vp dev` and `vp preview`, and the strict CSP in `vp preview`.
 */
export const referenceHost = (): Plugin => {
  let config: ResolvedConfig;
  return {
    name: "reference-host",
    configResolved(resolved) {
      config = resolved;
    },
    configureServer(server) {
      // The dev server's shell is the source page, transformed as Vite serves any HTML entry.
      const host = createHost(async () =>
        server.transformIndexHtml(
          `/${projectPageFile}`,
          await readFile(resolve(config.root, projectPageFile), "utf8"),
        ),
      );
      // No CSP in dev: the dev server injects CSS as <style> elements, which a strict `style-src` blocks.
      server.middlewares.use(hostMiddleware(host));
      server.httpServer?.once("close", () => void host.dispose());
    },
    configurePreviewServer(server) {
      const host = createHost(() =>
        readFile(resolve(config.root, config.build.outDir, projectPageFile), "utf8"),
      );
      server.middlewares.use(contentSecurityPolicyMiddleware);
      server.middlewares.use(hostMiddleware(host));
      server.httpServer.once("close", () => void host.dispose());
    },
  };
};
