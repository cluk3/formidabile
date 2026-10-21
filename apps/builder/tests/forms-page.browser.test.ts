import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { createBuilderClient } from "#lib/api.ts";
import FormsPage from "#lib/FormsPage.svelte";
import { analyst, config, fakeHost, json } from "./fake-host.ts";

const summary = (title: string) => ({
  id: crypto.randomUUID(),
  title,
  availability: "open",
  responseLimit: "unlimited",
  currentVersion: null,
  hasDraft: true,
  updatedAt: "2026-10-21T08:00:00.000Z",
});

test("an unknown outcome on create says so and reloads the form list", async () => {
  const forms: ReturnType<typeof summary>[] = [];
  // The host commits the create, but the reply is lost to a proxy's 502.
  const fetch = fakeHost(async (route, request) => {
    if (route === "GET /forms") return json(200, { forms });
    if (route === "POST /forms") {
      const { definition } = await request.json();
      forms.push(summary(definition.title));
      return new Response("Bad Gateway", { status: 502 });
    }
    return json(404, { _tag: "NotFound" });
  });
  const screen = await render(FormsPage, {
    client: createBuilderClient(config, fetch),
    signInHref: config.loginUrl,
  });
  await expect.element(screen.getByText("No forms yet")).toBeVisible();

  await screen.getByLabelText("Title").fill("Customer survey");
  await screen.getByRole("button", { name: "Create form" }).click();

  await expect.element(screen.getByText(/couldn.t confirm the form was created/i)).toBeVisible();
  await expect.element(screen.getByRole("listitem").getByText("Customer survey")).toBeVisible();
});

test("each listed form links to its editor", async () => {
  const form = summary("Customer survey");
  const fetch = fakeHost((route) =>
    route === "GET /forms" ? json(200, { forms: [form] }) : json(404, { _tag: "NotFound" }),
  );
  const screen = await render(FormsPage, {
    client: createBuilderClient(config, fetch),
    signInHref: config.loginUrl,
  });

  await expect
    .element(screen.getByRole("link", { name: "Customer survey" }))
    .toHaveAttribute("href", `/forms/${form.id}`);
});

test("a published form links to its responses and analytics, and an analyst isn't offered a create", async () => {
  const published = {
    ...summary("Published survey"),
    currentVersion: { id: crypto.randomUUID(), number: 1 },
  };
  const draft = summary("Draft survey");
  const fetch = fakeHost(
    (route) =>
      route === "GET /forms"
        ? json(200, { forms: [published, draft] })
        : json(404, { _tag: "NotFound" }),
    analyst,
  );
  const screen = await render(FormsPage, {
    client: createBuilderClient(config, fetch),
    signInHref: config.loginUrl,
  });

  const item = screen.getByRole("listitem").filter({ hasText: "Published survey" });
  await expect
    .element(item.getByRole("link", { name: "Responses" }))
    .toHaveAttribute("href", `/forms/${published.id}/responses`);
  await expect
    .element(item.getByRole("link", { name: "Analytics" }))
    .toHaveAttribute("href", `/forms/${published.id}/analytics`);
  const unpublished = screen.getByRole("listitem").filter({ hasText: "Draft survey" });
  await expect
    .element(unpublished.getByRole("link", { name: "Responses" }))
    .not.toBeInTheDocument();
  await expect
    .element(unpublished.getByRole("link", { name: "Analytics" }))
    .not.toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: "Create form" })).not.toBeInTheDocument();
});
