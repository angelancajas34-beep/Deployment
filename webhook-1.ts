// ─── Webhook Registration ─────────────────────────────────────────────────────
// Call once after deployment to tell Telegram where to send updates.
// Usage: deno run --allow-net --allow-env src/webhook.ts

import { config } from "./config.ts";

const BASE_URL = Deno.env.get("PUBLIC_URL");
if (!BASE_URL) throw new Error("Missing PUBLIC_URL env var");

const WEBHOOK_URL = `${BASE_URL}/webhook`;

const response = await fetch(
  `https://api.telegram.org/bot${config.BOT_TOKEN}/setWebhook`,
  {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url:          WEBHOOK_URL,
      secret_token: config.WEBHOOK_SECRET,
      allowed_updates: [
        "message",
        "edited_message",
        "channel_post",
        "callback_query",
        "chat_member",
        "my_chat_member",
        "chat_join_request",
        "inline_query",
      ],
    }),
  },
);

const result = await response.json();
console.log("[Webhook] Set result:", JSON.stringify(result, null, 2));
