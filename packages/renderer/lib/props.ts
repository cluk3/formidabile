import type { FormDefinition } from "@fb/core/definition";
import type { RendererError } from "./problems.ts";

/**
 * The page the respondent is now on. `title` is null when the page is untitled: the builder's "Page N"
 * label is never sent. `pageId` is null for a format-1 definition, which is one page with no stored id.
 */
export type PageChange = {
  readonly pageId: string | null;
  readonly title: string | null;
};

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
  /** Edit this response of the respondent's, on its own version, instead of starting a new one. */
  responseId?: string | undefined;
  /** After a submit's 201 or an edit's 200, with the response the module recorded. */
  onsubmitted?: (event: { readonly responseId: string }) => void;
  /** Whenever the renderer shows a refusal or a failure in place of, or above, the form. */
  onerror?: (event: RendererError) => void;
  /** The respondent moved to a page, including the first one shown. */
  onpagechange?: (event: PageChange) => void;
  preview?: undefined;
};

/** Renders a definition and validates its answers in the browser, and never calls the API. */
type PreviewProps = {
  preview: FormDefinition;
  apiBaseUrl?: undefined;
  formId?: undefined;
  getToken?: undefined;
  responseId?: undefined;
  onsubmitted?: undefined;
  onerror?: undefined;
  /** The respondent moved to a page, including the first one shown. */
  onpagechange?: (event: PageChange) => void;
};

export type RendererProps = LiveProps | PreviewProps;
