import { Composer, InlineKeyboard } from "https://deno.land/x/grammy@v1.36.1/mod.ts";
import { BotContext }               from "../middleware.ts";
import { db, keys, getOrNull }      from "../database.ts";
import { config }                   from "../config.ts";
import { generateId, timestamp }    from "../utils/id.ts";

// ─── Content Feature ──────────────────────────────────────────────────────────

export const contentFeature = new Composer<BotContext>();

export interface Post {
  postId:      string;
  text:        string;
  status:      "draft" | "scheduled" | "published";
  createdAt:   string;
  scheduledAt: string | null;
  chatId:      number | null;
}

// /post <text> — draft a new post
contentFeature.command("post", async (ctx) => {
  if (!ctx.isOwner) return;

  const text = ctx.match?.trim();
  if (!text) { await ctx.reply("Usage: /post <message text>"); return; }

  const postId = generateId("POST");
  const post: Post = {
    postId,
    text,
    status:      "draft",
    createdAt:   timestamp(),
    scheduledAt: null,
    chatId:      null,
  };

  await db.set(keys.post(postId), post);

  const keyboard = new InlineKeyboard()
    .text("👁 Preview",       `content:preview:${postId}`)
    .text("📅 Schedule +1h",  `content:schedule:${postId}`).row()
    .text("🚀 Publish Now",   `content:publish:${postId}`)
    .text("🗑 Delete",        `content:delete:${postId}`);

  await ctx.reply(
    `✅ *Post drafted*\nID: \`${postId}\`\n\n${text}`,
    { parse_mode: "Markdown", reply_markup: keyboard },
  );
});

// /listposts — show all drafts and scheduled posts
contentFeature.command("listposts", async (ctx) => {
  if (!ctx.isOwner) return;

  const lines: string[] = [];
  for await (const entry of db.list<Post>({ prefix: ["posts"] })) {
    const p = entry.value;
    lines.push(
      `• \`${p.postId}\` [${p.status}]` +
      (p.scheduledAt ? ` @ ${p.scheduledAt.slice(0, 16).replace("T", " ")}` : ""),
    );
  }

  await ctx.reply(
    lines.length ? `📝 *Posts:*\n\n${lines.join("\n")}` : "No posts.",
    { parse_mode: "Markdown" },
  );
});

// Callback: preview
contentFeature.callbackQuery(/^content:preview:(.+)$/, async (ctx) => {
  const post = await getOrNull<Post>(keys.post(ctx.match[1]));
  await ctx.answerCallbackQuery();
  await ctx.reply(
    post ? `👁 *Preview:*\n\n${post.text}` : "Post not found.",
    { parse_mode: "Markdown" },
  );
});

// Callback: schedule +1 hour
contentFeature.callbackQuery(/^content:schedule:(.+)$/, async (ctx) => {
  const postId = ctx.match[1];
  const post   = await getOrNull<Post>(keys.post(postId));
  if (!post) { await ctx.answerCallbackQuery("Post not found."); return; }

  const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const updated     = { ...post, status: "scheduled" as const, scheduledAt, chatId: ctx.chat?.id ?? config.OWNER_ID };

  await db.set(keys.post(postId), updated);
  await db.set(keys.scheduled(postId), { postId, scheduledAt, chatId: updated.chatId });

  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    `📅 *Scheduled*\n\`${postId}\` will publish at ${scheduledAt.slice(0, 16).replace("T", " ")} UTC`,
    { parse_mode: "Markdown" },
  );
});

// Callback: publish immediately
contentFeature.callbackQuery(/^content:publish:(.+)$/, async (ctx) => {
  const postId = ctx.match[1];
  await publishPost(postId, ctx.chat!.id, ctx.api);
  await ctx.answerCallbackQuery("Published!");
  await ctx.editMessageText(`🚀 Post \`${postId}\` published.`, { parse_mode: "Markdown" });
});

// Callback: delete draft
contentFeature.callbackQuery(/^content:delete:(.+)$/, async (ctx) => {
  const postId = ctx.match[1];
  await db.delete(keys.post(postId));
  await db.delete(keys.scheduled(postId));
  await ctx.answerCallbackQuery("Deleted.");
  await ctx.editMessageText(`🗑 Post \`${postId}\` deleted.`, { parse_mode: "Markdown" });
});

// Callback: content menu
contentFeature.callbackQuery("content:menu", async (ctx) => {
  await ctx.answerCallbackQuery();
  const keyboard = new InlineKeyboard()
    .text("📝 List Posts", "content:list").row()
    .text("◀ Back",        "dashboard:home");

  await ctx.editMessageText(
    "📝 *Content*\n\nUse /post <text> to draft a new post.",
    { parse_mode: "Markdown", reply_markup: keyboard },
  );
});

// ─── Shared publish helper (called by scheduler too) ──────────────────────────

export async function publishPost(
  postId: string,
  chatId: number,
  api: { sendMessage: (chatId: number, text: string, opts?: Record<string, unknown>) => Promise<unknown> },
): Promise<void> {
  const post = await getOrNull<Post>(keys.post(postId));
  if (!post) {
    console.warn(`[Content] publishPost: post ${postId} not found`);
    return;
  }

  await api.sendMessage(chatId, post.text);
  await db.delete(keys.post(postId));
  await db.delete(keys.scheduled(postId));

  console.log(`[Content] Published ${postId} to chat ${chatId}`);
}
