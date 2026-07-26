import { Composer, InlineKeyboard } from "https://deno.land/x/grammy@v1.36.1/mod.ts";
import { BotContext }               from "../middleware.ts";
import { db, keys, listAll }        from "../database.ts";

// ─── Community Feature ────────────────────────────────────────────────────────

export const communityFeature = new Composer<BotContext>();

interface MemberRecord {
  userId:    number;
  chatId:    number;
  username?: string;
  joinedAt:  string;
}

// New members — welcome message + persist record
communityFeature.on("message:new_chat_members", async (ctx) => {
  for (const member of ctx.message.new_chat_members) {
    if (member.is_bot) continue;

    await db.set(keys.member(ctx.chat.id, member.id), {
      userId:   member.id,
      chatId:   ctx.chat.id,
      username: member.username,
      joinedAt: new Date().toISOString(),
    } satisfies MemberRecord);

    await ctx.reply(
      `👋 Welcome to the community, *${member.first_name}!*\n\n` +
      `Please read the group rules and enjoy your stay.`,
      { parse_mode: "Markdown" },
    );
  }
});

// Member left — clean up record
communityFeature.on("message:left_chat_member", async (ctx) => {
  const member = ctx.message.left_chat_member;
  if (!member.is_bot) {
    await db.delete(keys.member(ctx.chat.id, member.id));
    console.log(`[Community] Member ${member.id} left chat ${ctx.chat.id}`);
  }
});

// Chat member status updates — detect bans / unbans / promotions
communityFeature.on("chat_member", async (ctx) => {
  const { old_chat_member, new_chat_member } = ctx.chatMember;
  const userId = new_chat_member.user.id;
  const chatId = ctx.chat.id;

  const wasBanned = old_chat_member.status !== "kicked";
  const isBanned  = new_chat_member.status === "kicked";
  const wasAdmin  = ["administrator", "creator"].includes(old_chat_member.status);
  const isAdmin   = ["administrator", "creator"].includes(new_chat_member.status);

  if (!wasBanned && isBanned) {
    await db.set(keys.banned(chatId, userId), { userId, chatId, bannedAt: new Date().toISOString() });
    console.log(`[Community] Banned: ${userId} in ${chatId}`);
  }

  if (wasBanned && !isBanned) {
    await db.delete(keys.banned(chatId, userId));
    console.log(`[Community] Unbanned: ${userId} in ${chatId}`);
  }

  if (!wasAdmin && isAdmin) {
    console.log(`[Community] Promoted to admin: ${userId} in ${chatId}`);
  }
});

// /members — owner count of tracked members in this chat
communityFeature.command("members", async (ctx) => {
  if (!ctx.isOwner) return;
  const members = await listAll<MemberRecord>(["members", ctx.chat.id]);
  await ctx.reply(`👥 *Tracked members in this chat: ${members.length}*`, {
    parse_mode: "Markdown",
  });
});

// /banned — list banned users in this chat
communityFeature.command("banned", async (ctx) => {
  if (!ctx.isOwner) return;
  const banned = await listAll<{ userId: number; bannedAt: string }>(["banned", ctx.chat.id]);

  const lines = banned.map((b) => `• ${b.userId} (banned ${b.bannedAt.slice(0, 10)})`);
  await ctx.reply(
    banned.length
      ? `🚫 *Banned users:*\n${lines.join("\n")}`
      : "No banned users on record.",
    { parse_mode: "Markdown" },
  );
});

// Callback: community menu
communityFeature.callbackQuery("community:menu", async (ctx) => {
  await ctx.answerCallbackQuery();
  const keyboard = new InlineKeyboard()
    .text("👥 Members",    "community:members")
    .text("🚫 Banned",     "community:banned").row()
    .text("◀ Back",        "dashboard:home");

  await ctx.editMessageText("📢 *Community*\n\nManage your group.", {
    parse_mode: "Markdown",
    reply_markup: keyboard,
  });
});
