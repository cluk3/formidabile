import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "vite-plus/test";
import { jwt } from "./api.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("test:pg needs DATABASE_URL");

// A host may build the handler in code that never serves, such as a Vite config during `vite build`.
test("a handler that never serves opens no connection, so its process can exit", async () => {
  const script = `
    import { createFormModuleHandler } from "@fb/http-api/web";
    createFormModuleHandler(${JSON.stringify({ databaseUrl, jwt })});
  `;

  const run = promisify(execFile)(
    process.execPath,
    ["--conditions=source", "--input-type=module", "--eval", script],
    { cwd: new URL("..", import.meta.url), timeout: 4_000 },
  );

  await expect(run).resolves.toBeDefined();
});
