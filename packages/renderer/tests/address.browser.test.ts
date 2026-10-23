import type { QuestionSnapshot } from "@fb/core/definition";
import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-svelte";
import { FormRenderer } from "@fb/renderer";
import { apiBaseUrl, definitionOf, fakeApi, formId, versionId } from "./fake-api.ts";

const addressId = "0192f0c4-0000-7000-8000-000000000140";

const line = (shown: boolean, required = false) => ({ shown, required });

const address = (required = false): QuestionSnapshot => ({
  id: addressId,
  type: "address",
  label: "Delivery address",
  required,
  config: {
    lines: {
      line1: line(true),
      line2: line(false),
      city: line(true, true),
      region: line(false),
      postalCode: line(true),
      country: line(true),
    },
  },
});

const staticToken = async () => "token-1";
const labelled = (label: string) => page.getByLabelText(label, { exact: true });

afterEach(() => {
  document.documentElement.lang = "";
});

test("address lines carry autocomplete tokens and the country list is named in the respondent's language", async () => {
  document.documentElement.lang = "de";
  const { requests } = fakeApi(definitionOf([address()]));
  await render(FormRenderer, { apiBaseUrl, formId, getToken: staticToken });

  await expect.element(labelled("Address line 1")).toBeVisible();
  expect(labelled("Address line 2").elements()).toEqual([]);
  expect(labelled("Region").elements()).toEqual([]);
  expect(labelled("Address line 1").element()).toHaveAttribute("autocomplete", "address-line1");
  expect(labelled("City (required)").element()).toHaveAttribute("autocomplete", "address-level2");
  expect(labelled("Postal code").element()).toHaveAttribute("autocomplete", "postal-code");
  expect(labelled("Country").element()).toHaveAttribute("autocomplete", "country");

  const select = labelled("Country").element() as HTMLSelectElement;
  const germany = [...select.options].find((option) => option.value === "DE");
  expect(germany?.textContent).toBe("Deutschland");
  expect(select.options).toHaveLength(250);

  await userEvent.fill(labelled("Address line 1"), "  10 High Street  ");
  await userEvent.fill(labelled("City (required)"), "London");
  await userEvent.selectOptions(labelled("Country"), "DE");
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  const submit = requests.find(({ method }) => method === "POST");
  expect(submit?.body).toEqual({
    versionId,
    idempotencyKey: expect.stringMatching(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    ),
    answers: {
      [addressId]: { line1: "10 High Street", city: "London", country: "DE" },
    },
  });
});

test("a required line blocks until it is filled, and an empty optional address sends no key", async () => {
  const { requests } = fakeApi(definitionOf([address()]));
  await render(FormRenderer, { apiBaseUrl, formId, getToken: staticToken });

  await userEvent.fill(labelled("Address line 1"), "10 High Street");
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect
    .element(page.getByText("Invalid input: expected string, received undefined"))
    .toBeVisible();
  expect(requests.some(({ method }) => method === "POST")).toBe(false);

  await userEvent.fill(labelled("City (required)"), "London");
  await userEvent.click(page.getByRole("button", { name: "Submit" }));
  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
});

test("an untouched optional address is left out of the submission", async () => {
  const { requests } = fakeApi(definitionOf([address()]));
  await render(FormRenderer, { apiBaseUrl, formId, getToken: staticToken });

  await userEvent.click(page.getByRole("button", { name: "Submit" }));
  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  const submit = requests.find(({ method }) => method === "POST");
  expect(submit?.body).toMatchObject({ answers: {} });
});
