import { buildAnswerSchema } from "@fb/core/answers";
import type { FormDefinition } from "@fb/core/definition";
import type { Schema } from "effect";
import { toJSONSchema } from "zod/mini";

const authority =
  "Advisory: the server validates every submission and edit itself, and its answer is final. " +
  "Send text trimmed.";

/** A version's answer schema as JSON Schema 2020-12, for browser validation in custom renderers (ADR 0010). */
export const answerJsonSchema = (definition: FormDefinition): Schema.JsonObject => ({
  ...(toJSONSchema(buildAnswerSchema(definition), {
    target: "draft-2020-12",
    io: "input",
  }) as Schema.JsonObject),
  description: authority,
  "x-fb-authoritative": false,
});
