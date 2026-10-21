import type { FormDefinition } from "@fb/core/definition";

/**
 * The host's credentials hook (ADR 0011). The renderer calls it before every request, with the form it is about
 * to reach, and sends the token it returns as a bearer token.
 */
export type GetToken = (request: { readonly formId: string }) => string | Promise<string>;

/** The renderer loads and submits the form by itself. */
type LiveProps = {
  apiBaseUrl: string;
  formId: string;
  getToken: GetToken;
  /** After a 201, with the response the module recorded. */
  onsubmitted?: (event: { readonly responseId: string }) => void;
  preview?: undefined;
};

/** Renders a definition and validates its answers in the browser, and never calls the API. */
type PreviewProps = {
  preview: FormDefinition;
  apiBaseUrl?: undefined;
  formId?: undefined;
  getToken?: undefined;
  onsubmitted?: undefined;
};

export type RendererProps = LiveProps | PreviewProps;
