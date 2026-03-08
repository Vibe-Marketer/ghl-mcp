/**
 * GHL MCP Server v2 — Configuration Constants
 */

export const CONFIG = {
  API: {
    BASE_URL: "https://services.leadconnectorhq.com",
    VERSION_STANDARD: "2021-07-28" as const,
    VERSION_LEGACY: "2021-04-15" as const,
    LOCATION_TOKEN_ENDPOINT: "https://services.leadconnectorhq.com/oauth/locationToken",
  },
  MCP: {
    NAME: "GoHighLevel MCP Server",
    VERSION: "2.0.0",
  },
  LOGGING: {
    REDACT_KEYS: ["api_key", "apikey", "token", "authorization", "password", "secret"],
  },
} as const;
