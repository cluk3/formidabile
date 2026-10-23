CREATE TABLE "form_management"."response_path" (
	"response_id" uuid,
	"question_id" uuid,
	"version_id" uuid NOT NULL,
	CONSTRAINT "response_path_pkey" PRIMARY KEY("response_id","question_id")
);
--> statement-breakpoint
CREATE INDEX "response_path_version_id_question_id_index" ON "form_management"."response_path" ("version_id","question_id");--> statement-breakpoint
ALTER TABLE "form_management"."response_path" ADD CONSTRAINT "response_path_response_fkey" FOREIGN KEY ("response_id","version_id") REFERENCES "form_management"."responses"("id","version_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "form_management"."response_path" ADD CONSTRAINT "response_path_question_fkey" FOREIGN KEY ("version_id","question_id") REFERENCES "form_management"."form_version_questions"("version_id","question_id");