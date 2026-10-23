-- Responses collected before show conditions existed were shown every question of their version (ADR-017).
INSERT INTO "form_management"."response_path" ("response_id", "question_id", "version_id")
SELECT "responses"."id", "form_version_questions"."question_id", "responses"."version_id"
FROM "form_management"."responses"
INNER JOIN "form_management"."form_version_questions"
	ON "form_version_questions"."version_id" = "responses"."version_id"
