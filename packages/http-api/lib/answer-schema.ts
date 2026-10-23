import { buildAnswerSchema } from "@fb/core/answers";
import { questionsOf, type FormDefinition, type QuestionSnapshot } from "@fb/core/definition";
import type { Schema } from "effect";
import { toJSONSchema } from "zod/mini";

const authority =
  "Advisory: the server validates every submission and edit itself, and its answer is final. " +
  "Send text trimmed. Dates must also fall within x-fb-minDate and x-fb-maxDate, and a number " +
  "must fall on x-fb-step, which only the server checks.";

/** What `toJSONSchema` drops: Zod's `refine`s and its trimming before the length check. */
const generatorFixes = (question: QuestionSnapshot): Schema.JsonObject => {
  switch (question.type) {
    case "text":
      return { pattern: "\\S" };
    case "multiple_choice":
      return { uniqueItems: true };
    case "date": {
      const { min, max } = question.config;
      return {
        ...(min === undefined ? {} : { "x-fb-minDate": min }),
        ...(max === undefined ? {} : { "x-fb-maxDate": max }),
      };
    }
    case "number":
      return question.config.step === undefined ? {} : { "x-fb-step": question.config.step };
    case "address":
      return { minProperties: 1 };
    default:
      return {};
  }
};

/** A version's answer schema as JSON Schema 2020-12, for browser validation in custom renderers (ADR 0010). */
export const answerJsonSchema = (definition: FormDefinition): Schema.JsonObject => {
  const schema = toJSONSchema(buildAnswerSchema(definition), {
    target: "draft-2020-12",
    io: "input",
  });
  const properties = schema.properties!;
  for (const question of questionsOf(definition)) {
    Object.assign(properties[question.id]!, generatorFixes(question));
  }
  return Object.assign(schema, {
    description: authority,
    "x-fb-authoritative": false,
  }) as Schema.JsonObject;
};
