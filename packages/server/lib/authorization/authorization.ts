import { Effect } from "effect";
import { Forbidden } from "../errors.ts";
import type { Actor, Capability } from "./actor.ts";

const admin = (actor: Actor, accepted: ReadonlyArray<Capability>, reported: Capability) =>
  actor._tag === "Identified" &&
  accepted.some((capability) => actor.capabilities.includes(capability))
    ? Effect.succeed(actor)
    : Effect.fail(new Forbidden({ capability: reported }));

/** An admin use case that needs `capability`. Anonymous actors never reach one. */
export const requireCapability = (actor: Actor, capability: Capability) =>
  admin(actor, [capability], capability);

/** Reading forms, versions and references serves analysts too (ADR 0010). */
export const requireAdminRead = (actor: Actor) =>
  admin(actor, ["forms:manage", "responses:read"], "responses:read");
