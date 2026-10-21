import { Clock, Crypto, Effect } from "effect";

const webCrypto = Crypto.make({
  randomBytes: (size) => crypto.getRandomValues(new Uint8Array(size)),
  digest: (algorithm, data) =>
    Effect.promise(() => crypto.subtle.digest(algorithm, new Uint8Array(data))).pipe(
      Effect.map((digest) => new Uint8Array(digest)),
    ),
});

/** UUIDv7 (ADR 0007): ordered by creation time, which comes from `Clock`. */
export const newId = Effect.orDie(webCrypto.randomUUIDv7());

/** Timestamps come from `Clock`, never `now()`, so `TestClock` makes them deterministic. */
export const currentInstant = Effect.map(Clock.currentTimeMillis, (millis) => new Date(millis));
