import { loadConfig } from "#lib/config.ts";
import type { LayoutLoad } from "./$types";

// The builder is a static single-page app: nothing renders on a server, and the runtime config is fetched in the browser.
export const ssr = false;

export const load: LayoutLoad = async ({ fetch }) => ({ config: await loadConfig(fetch) });
