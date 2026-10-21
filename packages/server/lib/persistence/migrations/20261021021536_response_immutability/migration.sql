-- ADR 0007 and ADR 0016: an edit changes only a response's revision, edit time and answers.
-- The trigger's arguments name the columns that never change.
CREATE FUNCTION "form_management"."reject_fixed_column_change"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
	fixed_column text;
BEGIN
	FOREACH fixed_column IN ARRAY TG_ARGV LOOP
		IF to_jsonb(OLD) -> fixed_column IS DISTINCT FROM to_jsonb(NEW) -> fixed_column THEN
			RAISE EXCEPTION '%.% never changes', TG_TABLE_NAME, fixed_column
				USING ERRCODE = 'restrict_violation';
		END IF;
	END LOOP;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "responses_fixed_columns" BEFORE UPDATE ON "form_management"."responses"
	FOR EACH ROW EXECUTE FUNCTION "form_management"."reject_fixed_column_change"(
		'id', 'form_id', 'version_id', 'respondent_id', 'limited', 'idempotency_key', 'submitted_at'
	);
--> statement-breakpoint
-- A response's references are fixed at submission (ADR 0012). Deletes stay allowed, so cascades work.
CREATE TRIGGER "response_external_refs_immutable" BEFORE UPDATE ON "form_management"."response_external_refs"
	FOR EACH ROW EXECUTE FUNCTION "form_management"."reject_change"();
