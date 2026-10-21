CREATE SEQUENCE "form_management"."draft_revisions" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "form_management"."drafts" (
	"form_id" uuid PRIMARY KEY,
	"revision" bigint DEFAULT nextval('form_management.draft_revisions') NOT NULL,
	"based_on_version_id" uuid,
	"definition" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_management"."form_version_questions" (
	"version_id" uuid,
	"question_id" uuid,
	"form_id" uuid NOT NULL,
	"type" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "form_version_questions_pkey" PRIMARY KEY("version_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "form_management"."form_versions" (
	"id" uuid PRIMARY KEY,
	"form_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"definition" jsonb NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"published_by" text NOT NULL,
	"derived_from_version_id" uuid,
	CONSTRAINT "form_versions_form_id_number_unique" UNIQUE("form_id","number"),
	CONSTRAINT "form_versions_id_form_id_unique" UNIQUE("id","form_id"),
	CONSTRAINT "form_versions_number_check" CHECK ("number" >= 1)
);
--> statement-breakpoint
CREATE TABLE "form_management"."forms" (
	"id" uuid PRIMARY KEY,
	"tenant" text NOT NULL,
	"availability" text NOT NULL,
	"response_limit" text NOT NULL,
	"current_version_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "forms_availability_check" CHECK ("availability" IN ('open', 'closed')),
	CONSTRAINT "forms_response_limit_check" CHECK ("response_limit" IN ('unlimited', 'one_per_respondent')),
	CONSTRAINT "forms_open_needs_version_check" CHECK ("availability" = 'closed' OR "current_version_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "form_management"."question_identities" (
	"form_id" uuid,
	"question_id" uuid,
	"type" text NOT NULL,
	CONSTRAINT "question_identities_pkey" PRIMARY KEY("form_id","question_id"),
	CONSTRAINT "question_identities_form_id_question_id_type_unique" UNIQUE("form_id","question_id","type")
);
--> statement-breakpoint
ALTER TABLE "form_management"."drafts" ADD CONSTRAINT "drafts_form_id_forms_id_fkey" FOREIGN KEY ("form_id") REFERENCES "form_management"."forms"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_management"."drafts" ADD CONSTRAINT "drafts_based_on_version_fkey" FOREIGN KEY ("based_on_version_id","form_id") REFERENCES "form_management"."form_versions"("id","form_id");--> statement-breakpoint
ALTER TABLE "form_management"."form_version_questions" ADD CONSTRAINT "form_version_questions_identity_fkey" FOREIGN KEY ("form_id","question_id","type") REFERENCES "form_management"."question_identities"("form_id","question_id","type");--> statement-breakpoint
ALTER TABLE "form_management"."form_version_questions" ADD CONSTRAINT "form_version_questions_version_fkey" FOREIGN KEY ("version_id","form_id") REFERENCES "form_management"."form_versions"("id","form_id");--> statement-breakpoint
ALTER TABLE "form_management"."form_versions" ADD CONSTRAINT "form_versions_form_id_forms_id_fkey" FOREIGN KEY ("form_id") REFERENCES "form_management"."forms"("id");--> statement-breakpoint
ALTER TABLE "form_management"."form_versions" ADD CONSTRAINT "form_versions_derived_from_version_fkey" FOREIGN KEY ("derived_from_version_id","form_id") REFERENCES "form_management"."form_versions"("id","form_id");--> statement-breakpoint
ALTER TABLE "form_management"."forms" ADD CONSTRAINT "forms_current_version_fkey" FOREIGN KEY ("current_version_id","id") REFERENCES "form_management"."form_versions"("id","form_id");--> statement-breakpoint
ALTER TABLE "form_management"."question_identities" ADD CONSTRAINT "question_identities_form_id_forms_id_fkey" FOREIGN KEY ("form_id") REFERENCES "form_management"."forms"("id");