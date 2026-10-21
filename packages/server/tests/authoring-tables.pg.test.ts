import { DatabaseTestPostgres } from "@fb/server/testing";
import { describeAuthoringTables } from "./authoring-tables.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("test:pg needs DATABASE_URL");

describeAuthoringTables(DatabaseTestPostgres(databaseUrl));
