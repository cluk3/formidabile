import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "svelte/compiler";
import { expect, test } from "vite-plus/test";

// A static `style="..."` attribute is parsed as an inline style, which a strict `style-src` blocks
// (ADR 0008). Dynamic values, `style:` directives and transitions go through CSSOM and stay allowed.
type Node = { type: string; [key: string]: unknown };

export const staticStyleAttributes = (source: string): string[] => {
  const found: string[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (node === null || typeof node !== "object") return;
    const n = node as Node;
    if (n.type === "Attribute" && n.name === "style" && Array.isArray(n.value)) {
      const parts = n.value as Node[];
      if (parts.length > 0 && parts.every((part) => part.type === "Text")) {
        found.push(parts.map((part) => String(part.data)).join(""));
      }
    }
    for (const value of Object.values(n)) visit(value);
  };
  visit(parse(source, { modern: true }).fragment);
  return found;
};

const libDirectory = fileURLToPath(new URL("../lib/", import.meta.url));
const components = readdirSync(libDirectory, { recursive: true, encoding: "utf8" }).filter((name) =>
  name.endsWith(".svelte"),
);

test("the detector flags a plain-text style attribute", () => {
  expect(staticStyleAttributes('<p style="color: red">x</p>')).toEqual(["color: red"]);
});

test("the detector allows dynamic styles and style directives", () => {
  expect(staticStyleAttributes('<p style="color: {c}">x</p><p style:color={c}>y</p>')).toEqual([]);
});

test.each(components)("%s has no static style attribute", (name) => {
  const source = readFileSync(new URL(name, `file://${libDirectory}`), "utf8");
  expect(staticStyleAttributes(source)).toEqual([]);
});
