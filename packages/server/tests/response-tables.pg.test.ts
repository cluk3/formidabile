import { DatabaseTestPostgres } from "@fb/server/testing";
import { describeResponseTables } from "./response-tables.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("test:pg needs DATABASE_URL");

describeResponseTables(DatabaseTestPostgres(databaseUrl));
