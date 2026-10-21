/** The runtime configuration served as `config.json` next to the static app, so one build runs against any host. */
export type BuilderConfig = {
  /** Where the API is served. */
  apiBaseUrl: string;
  /** `GET` with credentials for a bearer token for the signed-in admin. */
  tokenUrl: string;
  /** Where the "Sign in" link goes when there is no usable token. */
  loginUrl: string;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value !== "";

const parse = (value: unknown): BuilderConfig => {
  const field = (key: keyof BuilderConfig): unknown =>
    typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
  const apiBaseUrl = field("apiBaseUrl");
  const tokenUrl = field("tokenUrl");
  const loginUrl = field("loginUrl");
  if (!isNonEmptyString(apiBaseUrl) || !isNonEmptyString(tokenUrl) || !isNonEmptyString(loginUrl)) {
    throw new Error("config.json needs a non-empty string for apiBaseUrl, tokenUrl and loginUrl");
  }
  return { apiBaseUrl, tokenUrl, loginUrl };
};

export const loadConfig = async (fetch: typeof globalThis.fetch): Promise<BuilderConfig> => {
  const response = await fetch("/config.json");
  if (!response.ok) {
    throw new Error(`config.json failed to load: ${response.status}`);
  }
  return parse(await response.json());
};
