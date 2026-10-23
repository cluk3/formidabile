import { buildAnswerSchema } from "@fb/core/answers";
import {
  pagesOf,
  questionsOf,
  type FormDefinition,
  type QuestionSnapshot,
} from "@fb/core/definition";
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
    case "phone":
      return { pattern: "^\\+[0-9]{1,15}$" };
    case "url":
      // `format` cannot say "http or https, with a host". A URI format would also reject a non-ASCII host the server accepts.
      return { pattern: "^(?i:https?):\\/\\/[^\\s/?#]+[^\\s]*$" };
    case "time_of_day":
      return { pattern: "^(?:[01]\\d|2[0-3]):[0-5]\\d$" };
    case "date_time": {
      const { min, max } = question.config;
      return {
        ...(min === undefined ? {} : { "x-fb-minDateTime": min }),
        ...(max === undefined ? {} : { "x-fb-maxDateTime": max }),
      };
    }
    default:
      return {};
  }
};

/**
 * Question ids a jump can pass over. A jump to a later page passes over the pages between it and that
 * page; a jump to the end passes over every later page. The landing page is not passed over. A target
 * that is not a later page passes over nothing. Conditions are not solved: if a jump can skip the page,
 * the page is not on every path (ADR-017).
 */
const passedOver = (definition: FormDefinition): ReadonlySet<string> => {
  const pages = pagesOf(definition);
  const ids = new Set<string>();
  pages.forEach((page, index) => {
    for (const jump of page.jumps) {
      const target =
        jump.target === "end"
          ? pages.length
          : pages.findIndex((candidate) => candidate.id === jump.target);
      if (target <= index) continue;
      for (let cursor = index + 1; cursor < target; cursor += 1)
        for (const question of pages[cursor]!.questions) ids.add(question.id);
    }
  });
  return ids;
};

/**
 * A question is required in the advisory schema only when it is required on every path: it is required,
 * it has no show condition, and it sits on a page no jump can pass over. The server's check stays final.
 */
const requiredOnEveryPath = (definition: FormDefinition): string[] => {
  const skipped = passedOver(definition);
  return questionsOf(definition)
    .filter(
      (question) =>
        question.required && question.showCondition === undefined && !skipped.has(question.id),
    )
    .map((question) => question.id);
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
  const required = requiredOnEveryPath(definition);
  const { required: _required, ...rest } = schema;
  return Object.assign(rest, {
    description: authority,
    "x-fb-authoritative": false,
    ...(required.length === 0 ? {} : { required }),
  }) as Schema.JsonObject;
};
