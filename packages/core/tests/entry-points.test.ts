import { expect, test } from "vite-plus/test";

test("core is imported through its definition, answers and editing entry points", async () => {
  await expect(import("@fb/core/definition")).resolves.toBeTypeOf("object");
  await expect(import("@fb/core/answers")).resolves.toBeTypeOf("object");
  await expect(import("@fb/core/editing")).resolves.toBeTypeOf("object");
});

test("core has no root barrel", async () => {
  const root: string = "@fb/core";
  await expect(import(/* @vite-ignore */ root)).rejects.toThrow('"." is not exported');
});
