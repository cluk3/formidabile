/**
 * The renderer's `getToken` on a project's page. The host picks the form from the project, so the `formId` the
 * renderer passes never chooses what the token is bound to.
 */
export const projectGetToken =
  (projectId: string) =>
  async (_request: { readonly formId: string }): Promise<string> => {
    const response = await fetch(`/token?project=${encodeURIComponent(projectId)}`);
    if (!response.ok) throw new Error(`/token refused with ${response.status}`);
    return ((await response.json()) as { token: string }).token;
  };
