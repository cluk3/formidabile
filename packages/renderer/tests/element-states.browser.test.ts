import { afterEach, expect, test, vi } from "vite-plus/test";
import { apiBaseUrl, definitionOf, fakeApi, formId, questions, responseRead } from "./fake-api.ts";

// The built bundle, as in `element-bundle.browser.test.ts`; needs `vp run @fb/renderer#build` first.
// @ts-expect-error -- the built bundle ships no declarations, and importing it only defines the element.
await import("../dist/form-renderer.js");

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const responseId = "0192f0c4-0000-7000-8000-00000000e001";

const element = (attributes: Record<string, string>) => {
  const created = document.createElement("form-renderer");
  for (const [name, value] of Object.entries(attributes)) created.setAttribute(name, value);
  Object.assign(created, { getToken: async () => "token-1" });
  return created as HTMLElement & { shadowRoot: ShadowRoot };
};

test("with a response-id the element edits that response and fires submitted after saving", async () => {
  const definition = definitionOf([questions.parking]);
  const { requests } = fakeApi(definition, {
    reads: {
      [responseId]: () => responseRead(responseId, definition, { [questions.parking.id]: true }),
    },
  });
  const edited = element({
    "api-base-url": apiBaseUrl,
    "form-id": formId,
    "response-id": responseId,
  });
  const submitted = new Promise<unknown>((resolve) =>
    edited.addEventListener("submitted", (event) => resolve((event as CustomEvent).detail)),
  );
  document.body.append(edited);

  const no = () =>
    edited.shadowRoot?.querySelector<HTMLInputElement>("input[type=radio][value=false]");
  await expect.poll(() => edited.shadowRoot?.querySelector("input:checked")).toBeTruthy();
  no()!.click();
  edited.shadowRoot.querySelector<HTMLButtonElement>("[part=submit]")!.click();

  expect(await submitted).toEqual({ responseId });
  expect(requests.map(({ method, path, body }) => ({ method, path, body }))).toEqual([
    { method: "GET", path: `/api/respond/responses/${responseId}`, body: undefined },
    {
      method: "PUT",
      path: `/api/respond/responses/${responseId}`,
      body: { expectedRevision: "1", answers: { [questions.parking.id]: false } },
    },
  ]);
});

test("the element fires error with the refusal it shows", async () => {
  fakeApi(definitionOf([questions.parking]), {
    load: Response.json({ _tag: "FormClosed" }, { status: 409 }),
  });
  const refused = element({ "api-base-url": apiBaseUrl, "form-id": formId });
  const error = new Promise<unknown>((resolve) =>
    // The DOM types every "error" listener as an ErrorEvent; the element's is a CustomEvent.
    refused.addEventListener("error", (event) => resolve((event as Event as CustomEvent).detail)),
  );
  document.body.append(refused);

  expect(await error).toEqual({
    code: "closed",
    message: "This form is closed and no longer takes responses.",
  });
  expect(refused.shadowRoot.querySelector("[role=alert]")?.textContent).toBe(
    "This form is closed and no longer takes responses.",
  );
});
