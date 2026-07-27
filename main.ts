// ═══════════════════════════════════════════════════════════════════════════════
//   Single Deployment Entrypoint
//  One Bot · One Webhook · One Runtime · Five Features
// ═══════════════════════════════════════════════════════════════════════════════

import { Bot, webhookCallback }    from "https://deno.land/x/grammy@v1.36.1/mod.ts";

import { config }                  from "./config.ts";
import { BotContext, globalMiddleware } from "./middleware.ts";

// Features
import { dashboardFeature }        from "./dashboard.ts";
import { communityFeature }        from "./community.ts";
import { supportFeature }          from "./support.ts";
import { contentFeature }          from "./content.ts";
import { broadcastFeature }        from "./broadcast.ts";

// Workers
import { initializeScheduler }     from "./scheduler.ts";
// NOTE: initializeQueueWorker previously imported from "./workers/queue.ts",
// but no queue.ts file exists anywhere in this repo. That import has been
// removed below until the file is created — see message for details.

// ─── Step 1: Create Bot Instance ──────────────────────────────────────────────

const bot = new Bot<BotContext>(config.BOT_TOKEN);

// ─── Step 2: Register Global Middleware ───────────────────────────────────────
// Every update flows through: Authentication → Authorization →
// Context Builder → Audit → Analytics — before reaching any feature.

bot.use(globalMiddleware);

// ─── Step 3: Register Feature Modules ────────────────────────────────────────
// Each feature is an independent Composer. Adding a new feature means
// creating one file and adding one line here.

bot.use(dashboardFeature);   // /start, /stats, /audit, dashboard callbacks
bot.use(communityFeature);   // welcome, moderation, member events
bot.use(supportFeature);     // /support, /close, ticket relay, owner reply
bot.use(contentFeature);     // /post, /listposts, scheduling, publishing
bot.use(broadcastFeature);   // /broadcast, /broadcastlist, job status

// ─── Step 4: Register Queue Worker ───────────────────────────────────────────
// Deno KV queue — receives broadcast jobs, sends messages to all users.
// Uses the same bot instance as the webhook.
// DISABLED: queue.ts does not exist in this repo yet.

// initializeQueueWorker(bot);

// ─── Step 5: Register Scheduler ──────────────────────────────────────────────
// Cron / setInterval — polls for scheduled posts every minute.
// Uses the same bot instance as the webhook.

initializeScheduler(bot);

// ─── Step 6: Error Boundary ──────────────────────────────────────────────────

bot.catch((err) => {
  console.error("[Bot] Unhandled error:", err.message, {
    updateId: err.ctx?.update?.update_id,
    userId:   err.ctx?.from?.id,
  });
});

// ─── Step 7: Webhook Handler ──────────────────────────────────────────────────

const handleUpdate = webhookCallback(bot, "std/http");

// ─── Step 8: HTTP Server ──────────────────────────────────────────────────────

Deno.serve({ port: config.PORT }, async (req: Request): Promise<Response> => {
  const url = new URL(req.url);

  // ── GET /health ─────────────────────────────────────────────────────────────
  if (req.method === "GET" && url.pathname === "/health") {
    return Response.json({
      status:    "ok",
      env:       config.ENV,
      timestamp: new Date().toISOString(),
      features:  ["dashboard", "community", "support", "content", "broadcast"],
      workers:   ["scheduler"],
    });
  }

  // ── POST /webhook ────────────────────────────────────────────────────────────
  if (req.method === "POST" && url.pathname === "/webhook") {

    // Validate Telegram secret token
    const secret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (secret !== config.WEBHOOK_SECRET) {
      console.warn("[Webhook] Rejected — invalid secret token");
      return new Response("Unauthorized", { status: 401 });
    }

    // Pass update to grammY runtime
    try {
      return await handleUpdate(req);
    } catch (err) {
      console.error("[Webhook] Failed to handle update:", err);
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  return new Response("Not Found", { status: 404 });
});

// ─── BOT ONLINE ───────────────────────────────────────────────────────────────

console.log("═".repeat(60));
console.log(" TeleBotHost · ONLINE");
console.log("═".repeat(60));
console.log(` Port:     ${config.PORT}`);
console.log(` Env:      ${config.ENV}`);
console.log(` Webhook:  POST /webhook`);
console.log(` Health:   GET  /health`);
console.log(` Features: dashboard · community · support · content · broadcast`);
console.log(` Workers:  scheduler`);
console.log("═".repeat(60)
  );
