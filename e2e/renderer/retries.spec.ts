import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { seedProject } from "./projects.ts";

test("a submit whose reply is dropped is retried into the response the server stored the first time", async ({
  page,
  request,
}) => {
  const name = {
    id: randomUUID(),
    type: "text",
    label: "Your name",
    required: true,
    config: { display: "single_line" },
  };
  const { projectId, ids, api } = await seedProject(request, [
    { title: `Retreat sign-up ${randomUUID()}`, availability: "open", questions: [name] },
  ]);
  const [formId] = ids as [string];
  const submits = `**/api/respond/forms/${formId}/responses`;

  // The first submit reaches the server, which stores it, but its reply never reaches the renderer.
  let stored: { responseId: string } | undefined;
  await page.route(
    submits,
    async (route) => {
      stored = (await (await route.fetch()).json()) as { responseId: string };
      await route.abort("failed");
    },
    { times: 1 },
  );

  await page.goto(`/projects/${projectId}`);
  const element = page.locator("form-renderer");
  const confirmed = element.evaluate(
    (renderer) =>
      new Promise<string>((resolve) =>
        renderer.addEventListener("submitted", (event) =>
          resolve((event as CustomEvent<{ responseId: string }>).detail.responseId),
        ),
      ),
  );
  await element.getByLabel("Your name").fill("Ada");
  await element.getByRole("button", { name: "Submit" }).click();

  await expect(element.getByRole("alert")).toHaveText(
    "We couldn't confirm your response was received. Retry to send the same answers again.",
  );
  await expect(element.getByLabel("Your name")).toBeDisabled();
  expect(stored?.responseId).toEqual(expect.any(String));

  const [retried] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().endsWith(`/forms/${formId}/responses`),
    ),
    element.getByRole("button", { name: "Retry" }).click(),
  ]);
  await expect(element.getByText("Thank you, your response was received.")).toBeVisible();

  expect(retried.status()).toBe(201);
  expect(await retried.json()).toMatchObject({ responseId: stored?.responseId });
  expect(await confirmed).toBe(stored?.responseId);
  const { response } = await api("GET", `/responses/${stored?.responseId}`);
  expect(response.answers).toEqual({ [name.id]: "Ada" });
});
