import { DatabaseTestPostgres } from "@fb/server/testing";
import { describeAnalytics } from "./analytics.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("test:pg needs DATABASE_URL");

describeAnalytics(DatabaseTestPostgres(databaseUrl));
