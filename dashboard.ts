import { Composer, InlineKeyboard }            from "https://deno.land/x/grammy@v1.36.1/mod.ts";
import { BotContext }                           from "../middleware.ts";
import { getUserCount }                         from "../services/storage.ts";
import { getDailyActiveCount, getCommandStats } from "../services/analytics.ts";
import { recentAuditLogs }                      from "../services/audit.ts";

// ─── Dashboard Feature ────────────────────────────────────────────────────────

export const dashboardFeature = new Composer<BotContext>();

// /start — entry point for every user
dashboardFeature.command("start", async (ctx) => {
  const keyboard = new InlineKeyboard()
    .text("📊 Dashboard",  "dashboard:home").row()
    .text("🆘 Support",    "support:menu")
    .text("📢 Community",  "community:menu").row()
    .text("📝 Content",    "content:menu")
    .text("📣 Broadcast",  "broadcast:menu");

  await ctx.reply(
    `👋 Welcome, *${ctx.from?.first_name ?? "there"}!*\n\n` +
    `This bot is online and ready. Use the menu below to get started.`,
    { parse_mode: "Markdown", reply_markup: keyboard },
  );
});

// /stats — owner-only stats summary
dashboardFeature.command("stats", async (ctx) => {
  if (!ctx.isOwner) return;

  const [users, dau, commands] = await Promise.all([
    getUserCount(),
    getDailyActiveCount(),
    getCommandStats(),
  ]);

  const commandLines = Object.entries(commands)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([cmd, count]) => `  /${cmd}: ${count}`)
    .join("\n");

  await ctx.reply(
    `📊 *Bot Statistics*\n\n` +
    `👤 Total users: *${users}*\n` +
    `📅 Active today: *${dau}*\n\n` +
    `📌 *Top Commands:*\n${commandLines || "  No data yet"}`,
    { parse_mode: "Markdown" },
  );
});

// /audit — owner-only recent audit trail
dashboardFeature.command("audit", async (ctx) => {
  if (!ctx.isOwner) return;

  const logs = await recentAuditLogs(10);
  const lines = logs.map(
    (l) => `• [${l.ts.slice(11, 19)}] ${l.updateType} — user=${l.userId ?? "?"} action=${l.action}`,
  );

  await ctx.reply(
    `🔍 *Recent Audit Log*\n\n${lines.join("\n") || "No entries."}`,
    { parse_mode: "Markdown" },
  );
});

// Callback: main dashboard home
dashboardFeature.callbackQuery("dashboard:home", async (ctx) => {
  await ctx.answerCallbackQuery();

  const [users, dau] = await Promise.all([getUserCount(), getDailyActiveCount()]);

  const keyboard = new InlineKeyboard()
    .text("🆘 Support",   "support:menu")
    .text("📢 Community", "community:menu").row()
    .text("📝 Content",   "content:menu")
    .text("📣 Broadcast", "broadcast:menu");

  await ctx.editMessageText(
    `📊 *Dashboard*\n\n👤 Users: *${users}* · Active today: *${dau}*`,
    { parse_mode: "Markdown", reply_markup: keyboard },
  );
});
