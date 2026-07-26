import { Composer, InlineKeyboard } from "https://deno.land/x/grammy@v1.36.1/mod.ts";
import { BotContext }               from "../middleware.ts";
import { db, keys, listAll }        from "../database.ts";
import { generateId, timestamp }    from "../utils/id.ts";

// ─── Broadcast Feature ────────────────────────────────────────────────────────

export const broadcastFeature = new Composer<BotContext>();

export interface BroadcastJob {
  jobId:       string;
  text:        string;
  status:      "queued" | "running" | "done" | "failed";
  createdAt:   string;
  completedAt: string | null;
  sent:        number;
  failed:      number;
}

// /broadcast <message> — queue a broadcast to all users
broadcastFeature.command("broadcast", async (ctx) => {
  if (!ctx.isOwner) {
    await ctx.reply("⛔ Owner only.");
    return;
  }

  const text = ctx.match?.trim();
  if (!text) { await ctx.reply("Usage: /broadcast <message>"); return; }

  const jobId = generateId("BCAST");
  const job: BroadcastJob = {
    jobId,
    text,
    status:      "queued",
    createdAt:   timestamp(),
    completedAt: null,
    sent:        0,
    failed:      0,
  };

  await db.set(keys.broadcastJob(jobId), job);
  await db.enqueue({ type: "broadcast", jobId, text });

  const keyboard = new InlineKeyboard()
    .text("📊 Check Status", `broadcast:status:${jobId}`);

  await ctx.reply(
    `📣 *Broadcast queued*\nJob: \`${jobId}\`\n\nThe queue worker will send it to all users.`,
    { parse_mode: "Markdown", reply_markup: keyboard },
  );
});

// /broadcastlist — list all broadcast jobs
broadcastFeature.command("broadcastlist", async (ctx) => {
  if (!ctx.isOwner) return;

  const jobs = await listAll<BroadcastJob>(["broadcast_jobs"]);
  if (!jobs.length) { await ctx.reply("No broadcast jobs."); return; }

  const lines = jobs
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10)
    .map((j) =>
      `• \`${j.jobId}\` [${j.status}]\n  ✅ ${j.sent} sent · ❌ ${j.failed} failed`,
    );

  await ctx.reply(
    `📣 *Broadcast Jobs:*\n\n${lines.join("\n\n")}`,
    { parse_mode: "Markdown" },
  );
});

// Callback: check job status
broadcastFeature.callbackQuery(/^broadcast:status:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const jobId = ctx.match[1];
  const entry = await db.get<BroadcastJob>(keys.broadcastJob(jobId));

  if (!entry.value) {
    await ctx.reply("Job not found.");
    return;
  }

  const j = entry.value;
  await ctx.reply(
    `📣 *Broadcast ${j.jobId}*\n` +
    `Status: *${j.status}*\n` +
    `Sent: ${j.sent} · Failed: ${j.failed}\n` +
    (j.completedAt ? `Completed: ${j.completedAt.slice(0, 16).replace("T", " ")} UTC` : "In progress..."),
    { parse_mode: "Markdown" },
  );
});

// Callback: broadcast menu
broadcastFeature.callbackQuery("broadcast:menu", async (ctx) => {
  await ctx.answerCallbackQuery();
  const keyboard = new InlineKeyboard()
    .text("📋 Recent Jobs", "broadcast:list").row()
    .text("◀ Back",         "dashboard:home");

  await ctx.editMessageText(
    "📣 *Broadcast*\n\nUse /broadcast <text> to send a message to all users.",
    { parse_mode: "Markdown", reply_markup: keyboard },
  );
});
