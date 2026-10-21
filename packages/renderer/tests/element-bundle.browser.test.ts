import { afterEach, expect, test, vi } from "vite-plus/test";
import { apiBaseUrl, definitionOf, fakeApi, formId, questions, versionId } from "./fake-api.ts";

// Imports the built bundle that the `./element` export points at. Vite can't resolve a package's reference to
// itself, so this uses the file path. It covers the production style path that dev and source-level tests never
// exercise, and needs `vp run @fb/renderer#build` first.
// @ts-expect-error -- the built bundle ships no declarations, and importing it only defines the element.
await import("../dist/form-renderer.js");

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const getToken = vi.fn(async (_request: { readonly formId: string }) => "token-1");

// Svelte mounts a custom element's content in a microtask after it connects, and the form loads after that.
const mounted = async (): Promise<HTMLElement & { shadowRoot: ShadowRoot }> => {
  const element = document.createElement("form-renderer");
  element.setAttribute("api-base-url", apiBaseUrl);
  element.setAttribute("form-id", formId);
  Object.assign(element, { getToken });
  document.body.append(element);
  await expect.poll(() => element.shadowRoot?.querySelector("[part=submit]")).not.toBeNull();
  return element as HTMLElement & { shadowRoot: ShadowRoot };
};

test("the built element adopts one stylesheet and injects no <style> elements", async () => {
  fakeApi(definitionOf([questions.name]));
  const { shadowRoot } = await mounted();

  expect(shadowRoot.adoptedStyleSheets).toHaveLength(1);
  expect(shadowRoot.querySelectorAll("style")).toHaveLength(0);
});

test("the adopted stylesheet styles the outer tree and the nested components' markup", async () => {
  fakeApi(definitionOf([questions.name]));
  const { shadowRoot } = await mounted();

  expect(getComputedStyle(shadowRoot.querySelector(".title")!).color).toBe("rgb(10, 20, 30)");
  // The input's prompt, two components down.
  expect(getComputedStyle(shadowRoot.querySelector(".required")!).color).toBe("rgb(150, 30, 30)");
  // The card's `:global(.label)` rule reaches the label its input renders.
  expect(getComputedStyle(shadowRoot.querySelector(".label")!).fontWeight).toBe("600");
});

test("the title takes the host's --form-renderer-text", async () => {
  fakeApi(definitionOf([questions.name]));
  const element = await mounted();
  element.style.setProperty("--form-renderer-text", "rgb(1, 2, 3)");

  expect(getComputedStyle(element.shadowRoot.querySelector(".title")!).color).toBe("rgb(1, 2, 3)");
});

test("every element shares the same adopted stylesheet", async () => {
  fakeApi(definitionOf([questions.name]));
  const [first, second] = [await mounted(), await mounted()];

  expect(first.shadowRoot.adoptedStyleSheets[0]).toBe(second.shadowRoot.adoptedStyleSheets[0]);
});

test("the element loads through its getToken property and fires submitted after a 201", async () => {
  getToken.mockClear();
  const { requests } = fakeApi(definitionOf([questions.parking]));
  const element = await mounted();
  const submitted = new Promise<unknown>((resolve) =>
    element.addEventListener("submitted", (event) => resolve((event as CustomEvent).detail), {
      once: true,
    }),
  );

  element.shadowRoot.querySelector<HTMLInputElement>("input[type=radio][value=true]")!.click();
  element.shadowRoot.querySelector<HTMLButtonElement>("[part=submit]")!.click();

  expect(await submitted).toEqual({ responseId: expect.any(String) });
  expect(getToken.mock.calls).toEqual([[{ formId }], [{ formId }]]);
  expect(requests.map(({ method, path, body }) => ({ method, path, body }))).toEqual([
    { method: "GET", path: `/api/respond/forms/${formId}`, body: undefined },
    {
      method: "POST",
      path: `/api/respond/forms/${formId}/responses`,
      body: {
        versionId,
        idempotencyKey: expect.any(String),
        answers: { [questions.parking.id]: true },
      },
    },
  ]);
});
