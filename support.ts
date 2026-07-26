import { Composer, InlineKeyboard } from "https://deno.land/x/grammy@v1.36.1/mod.ts";
import { BotContext }               from "../middleware.ts";
import { db, keys, getOrNull }      from "../database.ts";
import { config }                   from "../config.ts";
import { generateId, timestamp }    from "../utils/id.ts";

// ─── Support Feature ──────────────────────────────────────────────────────────

export const supportFeature = new Composer<BotContext>();

interface Ticket {
  ticketId:  string;
  userId:    number;
  username?: string;
  firstName: string;
  status:    "open" | "closed";
  createdAt: string;
  closedAt?: string;
}

// /support — open a new ticket (private chat only)
supportFeature.command("support", async (ctx) => {
  if (ctx.chat?.type !== "private") {
    await ctx.reply("Please use /support in a private chat with me.");
    return;
  }

  const userId   = ctx.from!.id;
  const existing = await getOrNull<Ticket>(keys.userTicket(userId));

  if (existing?.status === "open") {
    await ctx.reply(
      `You already have an open ticket (*${existing.ticketId}*).\n\n` +
      `Send a message here and it will be forwarded to support.\n` +
      `Use /close to close your ticket.`,
      { parse_mode: "Markdown" },
    );
    return;
  }

  const ticketId = generateId("TKT");
  const ticket: Ticket = {
    ticketId,
    userId,
    username:  ctx.from?.username,
    firstName: ctx.from!.first_name,
    status:    "open",
    createdAt: timestamp(),
  };

  await db.set(keys.ticket(ticketId), ticket);
  await db.set(keys.userTicket(userId), ticket);

  await ctx.reply(
    `🎫 Ticket *${ticketId}* opened.\n\nSend your message — support will reply shortly.\nUse /close when resolved.`,
    { parse_mode: "Markdown" },
  );

  // Notify owner
  const keyboard = new InlineKeyboard()
    .text(`📨 Reply to ${ctx.from!.first_name}`, `support:reply:${userId}`);

  await ctx.api.sendMessage(
    config.OWNER_ID,
    `🆕 *New Support Ticket*\n` +
    `Ticket: *${ticketId}*\n` +
    `From: ${ctx.from!.first_name}${ctx.from?.username ? ` (@${ctx.from.username})` : ""}\n` +
    `User ID: \`${userId}\``,
    { parse_mode: "Markdown", reply_markup: keyboard },
  );
});

// /close — user closes their own ticket
supportFeature.command("close", async (ctx) => {
  const userId = ctx.from!.id;
  const ticket = await getOrNull<Ticket>(keys.userTicket(userId));

  if (!ticket || ticket.status !== "open") {
    await ctx.reply("You have no open ticket.");
    return;
  }

  const closed = { ...ticket, status: "closed" as const, closedAt: timestamp() };
  await db.set(keys.ticket(ticket.ticketId), closed);
  await db.delete(keys.userTicket(userId));

  await ctx.reply(`✅ Ticket *${ticket.ticketId}* closed. Thank you!`, { parse_mode: "Markdown" });
});

// Relay user messages to owner (private chat, open ticket)
supportFeature.on("message:text", async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId || ctx.chat?.type !== "private") return next();
  if (ctx.isOwner) return next(); // owner messages handled separately

  const ticket = await getOrNull<Ticket>(keys.userTicket(userId));
  if (!ticket || ticket.status !== "open") return next();

  // Relay to owner
  const keyboard = new InlineKeyboard()
    .text(`📨 Reply`, `support:reply:${userId}`);

  await ctx.api.sendMessage(
    config.OWNER_ID,
    `💬 *${ticket.ticketId}* — ${ticket.firstName}:\n${ctx.message.text}`,
    { parse_mode: "Markdown", reply_markup: keyboard },
  );

  await ctx.reply("✅ Message sent to support.");
});

// Owner initiates a reply via callback
supportFeature.callbackQuery(/^support:reply:(\d+)$/, async (ctx) => {
  const targetId = Number(ctx.match[1]);
  await ctx.answerCallbackQuery();

  // Store pending reply target with 90-second TTL
  await db.set(keys.ownerReply(), targetId, { expireIn: 90_000 });
  await ctx.reply(
    `📨 Reply to user \`${targetId}\` — send your message now (90 seconds):`,
    { parse_mode: "Markdown" },
  );
});

// Capture owner reply and forward to user
supportFeature.on("message:text", async (ctx, next) => {
  if (!ctx.isOwner) return next();

  const targetId = await getOrNull<number>(keys.ownerReply());
  if (!targetId) return next();

  await ctx.api.sendMessage(
    targetId,
    `📩 *Support reply:*\n${ctx.message.text}`,
    { parse_mode: "Markdown" },
  );

  await db.delete(keys.ownerReply());
  await ctx.reply("✅ Reply delivered.");
});

// Callback: support menu
supportFeature.callbackQuery("support:menu", async (ctx) => {
  await ctx.answerCallbackQuery();
  const keyboard = new InlineKeyboard()
    .text("🎫 Open Ticket", "support:open").row()
    .text("◀ Back",         "dashboard:home");

  await ctx.editMessageText(
    "🆘 *Support*\n\nOpen a ticket and our team will get back to you.",
    { parse_mode: "Markdown", reply_markup: keyboard },
  );
});
