import { afterEach, expect, test, vi } from "vite-plus/test";
import { projectGetToken } from "../src/project-token.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("the project page's getToken asks /token for the project, whatever form it's given", async () => {
  const fetch = vi.fn(async (_url: string) => Response.json({ token: "minted" }));
  vi.stubGlobal("fetch", fetch);

  const token = await projectGetToken("acme-spring orders")({ formId: "some-other-form" });

  expect(token).toBe("minted");
  expect(fetch.mock.calls).toEqual([["/token?project=acme-spring%20orders"]]);
});

// ADR 0011: `getToken` returns a string, never `null`, so a refusal fails the renderer's request.
test("the project page's getToken rejects when /token refuses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ error: "No single open form" }, { status: 404 })),
  );

  await expect(projectGetToken("acme-gone")({ formId: "f" })).rejects.toThrow(
    "/token refused with 404",
  );
});
