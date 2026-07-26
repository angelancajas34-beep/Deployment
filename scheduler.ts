import { Bot }             from "https://deno.land/x/grammy@v1.36.1/mod.ts";
import { BotContext }      from "../middleware.ts";
import { db }              from "../database.ts";
import { publishPost }     from "../features/content.ts";
import { config }          from "../config.ts";

// ─── Scheduler ────────────────────────────────────────────────────────────────
// Polls every minute for content posts whose scheduledAt time has passed.
// Uses Deno.cron on Deno Deploy; falls back to setInterval in local dev.

interface ScheduledEntry {
  postId:      string;
  scheduledAt: string;
  chatId:      number;
}

export function initializeScheduler(bot: Bot<BotContext>): void {
  const tick = async () => {
    const now = new Date().toISOString();

    for await (const entry of db.list<ScheduledEntry>({ prefix: ["scheduled"] })) {
      const { postId, scheduledAt, chatId } = entry.value;

      if (scheduledAt <= now) {
        console.log(`[Scheduler] Publishing ${postId} → chat ${chatId}`);
        await publishPost(postId, chatId ?? config.OWNER_ID, bot.api);
      }
    }
  };

  if (typeof Deno.cron === "function") {
    Deno.cron("content-scheduler", "* * * * *", tick);
    console.log("[Scheduler] Deno.cron registered — every minute.");
  } else {
    setInterval(tick, 60_000);
    console.log("[Scheduler] setInterval fallback — every minute.");
  }
}
