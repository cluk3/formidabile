/**
 * The host's credentials hook (ADR 0011). The renderer calls it before every request, with the form it is about
 * to reach, and sends the token it returns as a bearer token.
 */
export type GetToken = (request: { readonly formId: string }) => string | Promise<string>;
