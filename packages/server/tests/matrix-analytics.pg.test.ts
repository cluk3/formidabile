import { DatabaseTestPostgres } from "@fb/server/testing";
import { describeMatrixAnalytics } from "./matrix-analytics.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("test:pg needs DATABASE_URL");

describeMatrixAnalytics(DatabaseTestPostgres(databaseUrl));
