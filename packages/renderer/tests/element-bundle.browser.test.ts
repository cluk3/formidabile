import { expect, test } from "vite-plus/test";

// Imports the built bundle that the `./element` export points at. Vite can't resolve a package's reference to
// itself, so this uses the file path. It covers the production style path that dev and source-level tests never
// exercise, and needs `vp run @fb/renderer#build` first.
// @ts-expect-error -- the built bundle ships no declarations, and importing it only defines the element.
await import("../dist/form-renderer.js");

// Svelte mounts a custom element's content in a microtask after it connects.
const mounted = async (): Promise<ShadowRoot> => {
  const element = document.createElement("form-renderer");
  document.body.append(element);
  await expect.poll(() => element.shadowRoot?.querySelector("[part=submit]")).not.toBeNull();
  return element.shadowRoot!;
};

test("the built element adopts one stylesheet and injects no <style> elements", async () => {
  const shadow = await mounted();

  expect(shadow.adoptedStyleSheets).toHaveLength(1);
  expect(shadow.querySelectorAll("style")).toHaveLength(0);
});

test("the adopted stylesheet styles the wrapper's and a nested component's markup", async () => {
  const shadow = await mounted();

  expect(getComputedStyle(shadow.querySelector(".title")!).color).toBe("rgb(10, 20, 30)");
  expect(getComputedStyle(shadow.querySelector(".value")!).color).toBe("rgb(0, 128, 0)");
});

test("a :global() rule in an inner component reaches the shadow root through the adopted sheet", async () => {
  const shadow = await mounted();

  expect(getComputedStyle(shadow.querySelector(".global-marker")!).textDecorationLine).toBe(
    "underline",
  );
});

test("every element shares the same adopted stylesheet", async () => {
  const [first, second] = [await mounted(), await mounted()];

  expect(first.adoptedStyleSheets[0]).toBe(second.adoptedStyleSheets[0]);
});
