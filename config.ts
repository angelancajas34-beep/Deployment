// ─── Config ───────────────────────────────────────────────────────────────────
// All required env vars are validated immediately when this module loads.
// A missing value crashes the process at startup, not mid-request.

function require(key: string): string {
  const val = Deno.env.get(key);
  if (!val) throw new Error(`[Config] Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return Deno.env.get(key) ?? fallback;
}

export const config = {
  BOT_TOKEN:      require("BOT_TOKEN"),
  WEBHOOK_SECRET: require("WEBHOOK_SECRET"),
  OWNER_ID:       Number(require("OWNER_ID")),
  PORT:           Number(optional("PORT", "8000")),
  ENV:            optional("ENV", "production") as "production" | "development",
} as const;

export type Config = typeof config;
