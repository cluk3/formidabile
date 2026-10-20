import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, test } from "vite-plus/test";

// Drizzle's rc5 declarations import `effect/unstable/sql/SqlError`, which Effect 4 removed. Without the
// `paths` shim in tsconfig.server.json, `db.transaction`'s error channel silently loses `SqlError`.
const probeFile = fileURLToPath(new URL("transaction-error.probe.ts", import.meta.url));
const probe = `
import { Database } from "@fb/server/database";
import { Effect } from "effect";

declare const db: Database["Service"];
export const failure: Effect.Effect<never, "boom"> = db.transaction(() => Effect.fail("boom" as const));
`;

const compilerOptions = () => {
  const configFile = fileURLToPath(new URL("../tsconfig.json", import.meta.url));
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configFile,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
      },
    },
  );
  if (!parsed) throw new Error(`Cannot read ${configFile}`);
  return parsed.options;
};

const probeErrorCodes = (options: ts.CompilerOptions) => {
  const host = ts.createCompilerHost(options);
  const program = ts.createProgram([probeFile], options, {
    ...host,
    fileExists: (fileName) => fileName === probeFile || host.fileExists(fileName),
    readFile: (fileName) => (fileName === probeFile ? probe : host.readFile(fileName)),
    getSourceFile: (fileName, languageVersion, ...rest) =>
      fileName === probeFile
        ? ts.createSourceFile(fileName, probe, languageVersion)
        : host.getSourceFile(fileName, languageVersion, ...rest),
  });
  return ts.getPreEmitDiagnostics(program).map((diagnostic) => diagnostic.code);
};

test("with the shim, a transaction's error channel includes SqlError", () => {
  expect(probeErrorCodes(compilerOptions())).toEqual([2322]);
}, 60_000);

test("without the shim, Drizzle still erases SqlError (once this fails, delete the shim and this test)", () => {
  const { paths: _shim, ...withoutShim } = compilerOptions();

  expect(probeErrorCodes(withoutShim)).toEqual([]);
}, 60_000);
