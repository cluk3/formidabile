import type { IdSource } from "@fb/core/editing";

/**
 * Fresh question identities and option values from Web Crypto. `crypto.randomUUID()` needs a secure context, which
 * includes localhost.
 */
export const webCryptoIds: IdSource = {
  questionId: () => crypto.randomUUID(),
  optionValue: () => crypto.randomUUID(),
};
