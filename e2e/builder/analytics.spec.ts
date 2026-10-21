import { randomUUID } from "node:crypto";
import { type APIRequestContext, expect, type Locator, request, test } from "@playwright/test";

type DevUser = "acme-admin" | "alice" | "bob";

const contexts: APIRequestContext[] = [];
test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((context) => context.dispose()));
});

/** A client for the module behind the reference host, signed in as `user` with its own cookies. */
const hostApi = async (user: DevUser) => {
  const context = await request.newContext({ baseURL: "http://localhost:4173" });
  contexts.push(context);
  await context.post("/login", { form: { user } });
  const { token } = (await (await context.get("/token")).json()) as { token: string };
  return async (method: "POST" | "PUT" | "PATCH", path: string, data: unknown) => {
    const response = await context.fetch(`/api${path}`, {
      method,
      data,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.ok(), `${method} ${path} as ${user}`).toBe(true);
    return response.json();
  };
};

/** The cells beside the row header `header` in `table`. */
const cellsOf = (table: Locator, header: string) =>
  table
    .getByRole("row")
    .filter({ has: table.page().getByRole("rowheader", { name: header, exact: true }) })
    .getByRole("cell");

test("the analytics view counts each version's responses and keeps a dropped question out of its version", async ({
  page,
}) => {
  const admin = await hostApi("acme-admin");
  const respondents = { alice: await hostApi("alice"), bob: await hostApi("bob") };
  const pick = {
    id: randomUUID(),
    type: "single_choice",
    label: "Pick a colour",
    required: true,
    config: {
      display: "radio",
      options: [
        { value: "red", label: "Red" },
        { value: "blue", label: "Blue" },
      ],
    },
  };
  const comment = {
    id: randomUUID(),
    type: "text",
    label: "Any comment?",
    required: false,
    config: { display: "single_line" },
  };
  const title = `Analytics in e2e ${randomUUID()}`;
  const definition = (questions: object[]) => ({ format: 1, title, questions });

  const { form, draft } = await admin("POST", "/forms", {
    definition: definition([pick, comment]),
  });
  const v1 = await admin("POST", `/forms/${form.id}/draft/publish`, {
    expectedRevision: draft.revision,
  });
  await admin("PATCH", `/forms/${form.id}`, { availability: "open" });
  const submit = (user: "alice" | "bob", versionId: string, answers: object) =>
    respondents[user]("POST", `/respond/forms/${form.id}/responses`, {
      versionId,
      answers,
      idempotencyKey: randomUUID(),
    });
  await submit("alice", v1.version.id, { [pick.id]: "red", [comment.id]: "Lovely" });
  await submit("bob", v1.version.id, { [pick.id]: "blue" });

  const widened = {
    ...pick,
    config: {
      ...pick.config,
      options: [...pick.config.options, { value: "green", label: "Green" }],
    },
  };
  const v2Draft = await admin("PUT", `/forms/${form.id}/draft`, {
    expectedRevision: null,
    definition: definition([widened]),
  });
  const v2 = await admin("POST", `/forms/${form.id}/draft/publish`, {
    expectedRevision: v2Draft.revision,
  });
  await submit("alice", v2.version.id, { [pick.id]: "green" });

  await page.goto("/");
  await page.getByRole("link", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "acme-admin" }).click();
  await page
    .getByRole("listitem")
    .filter({ hasText: title })
    .getByRole("link", { name: "Analytics", exact: true })
    .click();

  const versions = page.getByRole("table", { name: "Responses by version" });
  await expect(cellsOf(versions, "Version 1").first()).toHaveText("2");
  await expect(cellsOf(versions, "Version 2").first()).toHaveText("1");
  await expect(cellsOf(versions, "All versions").first()).toHaveText("3");

  const colour = page.getByRole("region", { name: "Pick a colour", exact: true });
  const colourByVersion = colour.getByRole("table", { name: "By version" });
  await expect(cellsOf(colourByVersion, "Version 1")).toHaveText([
    "2",
    "2",
    "0",
    "Red: 1 · Blue: 1",
  ]);
  await expect(cellsOf(colourByVersion, "Version 2")).toHaveText([
    "1",
    "1",
    "0",
    "Red: 0 · Blue: 0 · Green: 1",
  ]);
  const colourCombined = colour.getByRole("table", { name: "All versions" });
  await expect(cellsOf(colourCombined, "Green")).toHaveText(["1", "100%", "Version 2"]);

  const dropped = page.getByRole("region", { name: "Any comment?", exact: true });
  await expect(dropped.getByText("Not in the current version.")).toBeVisible();
  await expect(
    dropped.getByText(
      "2 responses: 1 answered, 1 skipped. Not asked in 1 response, to versions without it.",
    ),
  ).toBeVisible();
  const droppedByVersion = dropped.getByRole("table", { name: "By version" });
  await expect(cellsOf(droppedByVersion, "Version 1")).toHaveText(["2", "1", "1", ""]);
  await expect(cellsOf(droppedByVersion, "Version 2")).toHaveText(["Not in this version"]);
});
