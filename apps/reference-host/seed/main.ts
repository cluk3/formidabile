import { createFormModuleHandler } from "@fb/http-api/web";
import { databaseUrl } from "../server/database-url.ts";
import { devJwt } from "../server/dev-users.ts";
import { seed } from "./seed.ts";

// No server: the seed migrates and drives its own handler in-process, checking tokens as `/api` does.
const handler = createFormModuleHandler({ databaseUrl, jwt: devJwt });
try {
  await handler.migrate();
  await seed(handler.fetch);
  console.log("Seeded the demo projects in acme and globex.");
} finally {
  await handler.dispose();
}
