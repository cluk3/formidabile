import { writeFileSync } from "node:fs";
import { OpenApi } from "effect/http-api";
import { FormApi } from "../index.ts";

const document = OpenApi.fromApi(FormApi);

writeFileSync(
  new URL("../openapi.json", import.meta.url),
  `${JSON.stringify(document, null, 2)}\n`,
);
