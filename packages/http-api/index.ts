import { HttpApi, HttpApiBuilder, OpenApi } from "effect/http-api";

export class FormApi extends HttpApi.make("FormApi").annotateMerge(
  OpenApi.annotations({ title: "Form module API", version: "0.1.0" }),
) {}

export const FormApiLive = HttpApiBuilder.layer(FormApi);
