CREATE TABLE "form_management"."answers" (
	"response_id" uuid,
	"question_id" uuid,
	"version_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	CONSTRAINT "answers_pkey" PRIMARY KEY("response_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "form_management"."form_external_refs" (
	"form_id" uuid,
	"namespace" text,
	"ref_id" text,
	CONSTRAINT "form_external_refs_pkey" PRIMARY KEY("form_id","namespace","ref_id"),
	CONSTRAINT "form_external_refs_namespace_check" CHECK (char_length("namespace") <= 64 AND "namespace" ~ '^[a-z][a-z0-9_.-]*$'),
	CONSTRAINT "form_external_refs_ref_id_check" CHECK (char_length("ref_id") BETWEEN 1 AND 255)
);
--> statement-breakpoint
CREATE TABLE "form_management"."response_external_refs" (
	"response_id" uuid,
	"namespace" text,
	"ref_id" text,
	CONSTRAINT "response_external_refs_pkey" PRIMARY KEY("response_id","namespace","ref_id"),
	CONSTRAINT "response_external_refs_namespace_check" CHECK (char_length("namespace") <= 64 AND "namespace" ~ '^[a-z][a-z0-9_.-]*$'),
	CONSTRAINT "response_external_refs_ref_id_check" CHECK (char_length("ref_id") BETWEEN 1 AND 255)
);
--> statement-breakpoint
CREATE TABLE "form_management"."responses" (
	"id" uuid PRIMARY KEY,
	"form_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"respondent_id" text,
	"limited" boolean NOT NULL,
	"revision" integer NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"edited_at" timestamp with time zone,
	CONSTRAINT "responses_id_version_id_unique" UNIQUE("id","version_id"),
	CONSTRAINT "responses_idempotency_key_unique" UNIQUE NULLS NOT DISTINCT("form_id","respondent_id","idempotency_key"),
	CONSTRAINT "responses_revision_check" CHECK ("revision" >= 1),
	CONSTRAINT "responses_limited_needs_respondent_check" CHECK (NOT "limited" OR "respondent_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX "answers_version_id_question_id_index" ON "form_management"."answers" ("version_id","question_id");--> statement-breakpoint
CREATE INDEX "form_external_refs_namespace_ref_id_index" ON "form_management"."form_external_refs" ("namespace","ref_id");--> statement-breakpoint
CREATE INDEX "response_external_refs_namespace_ref_id_index" ON "form_management"."response_external_refs" ("namespace","ref_id");--> statement-breakpoint
CREATE UNIQUE INDEX "responses_one_per_respondent" ON "form_management"."responses" ("form_id","respondent_id") WHERE "limited";--> statement-breakpoint
CREATE INDEX "responses_form_id_version_id_index" ON "form_management"."responses" ("form_id","version_id");--> statement-breakpoint
CREATE INDEX "responses_respondent_id_index" ON "form_management"."responses" ("respondent_id");--> statement-breakpoint
ALTER TABLE "form_management"."answers" ADD CONSTRAINT "answers_response_fkey" FOREIGN KEY ("response_id","version_id") REFERENCES "form_management"."responses"("id","version_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_management"."answers" ADD CONSTRAINT "answers_question_fkey" FOREIGN KEY ("version_id","question_id") REFERENCES "form_management"."form_version_questions"("version_id","question_id");--> statement-breakpoint
ALTER TABLE "form_management"."form_external_refs" ADD CONSTRAINT "form_external_refs_form_id_forms_id_fkey" FOREIGN KEY ("form_id") REFERENCES "form_management"."forms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_management"."response_external_refs" ADD CONSTRAINT "response_external_refs_response_id_responses_id_fkey" FOREIGN KEY ("response_id") REFERENCES "form_management"."responses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_management"."responses" ADD CONSTRAINT "responses_version_fkey" FOREIGN KEY ("version_id","form_id") REFERENCES "form_management"."form_versions"("id","form_id") ON DELETE RESTRICT;