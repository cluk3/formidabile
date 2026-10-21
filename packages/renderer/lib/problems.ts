/** Everything the renderer can show instead of the form, or above it, apart from per-question errors. */
export const messages = {
  signInRequired: "Sign in to respond to this form.",
  sessionExpired: "Your session has expired. Sign in again to continue.",
  closed: "This form is closed and no longer takes responses.",
  unavailable: "This form isn't available.",
  notFound: "This form couldn't be found.",
  unsupported:
    "This form uses a question type this renderer doesn't support, so it can't be shown.",
  loadFailed: "This form couldn't be loaded.",
  sendFailed: "We couldn't send your response. Please try again.",
  submitUnconfirmed:
    "We couldn't confirm your response was received. Retry to send the same answers again.",
  editUnconfirmed:
    "We couldn't confirm your changes were saved. Reload the response to see the saved answers, or stay to keep yours on screen.",
  tooLarge: "Your answers are too long to send.",
  versionSuperseded:
    "This form was updated while you were answering. Reload it to answer the new version. Your answers won't carry over.",
  revisionConflict:
    "Your response was changed somewhere else since you opened it. Reload it to see the saved answers, or stay to keep yours on screen.",
  alreadyResponded: "You've already responded to this form.",
} as const;

export type ProblemCode = keyof typeof messages;

/** The `error` event's detail, and `onerror`'s argument. */
export type RendererError = { readonly code: ProblemCode; readonly message: string };

/** The 401 message by `reason` (ADR 0011): a missing token or a grant needs a sign-in, a bad one has expired. */
export const unauthenticated = (
  reason: "missing" | "invalid" | "identityRequired",
): "signInRequired" | "sessionExpired" =>
  reason === "invalid" ? "sessionExpired" : "signInRequired";
