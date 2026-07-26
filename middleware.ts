import { Composer, Context } from "https://deno.land/x/grammy@v1.36.1/mod.ts";
import { config }                        from "./config.ts";
import { appendAudit }                   from "./services/audit.ts";
import { trackActiveUser, trackCommand } from "./services/analytics.ts";
import { upsertUser }                    from "./services/storage.ts";

// ─── Extended Context ─────────────────────────────────────────────────────────

export interface BotContext extends Context {
  isOwner:      boolean;
  isRegistered: boolean;
  startedAt:    number;
}

// ─── Global Middleware Stack ──────────────────────────────────────────────────
// Execution order: Authentication → Authorization → Context Builder → Audit → Analytics

export const globalMiddleware = new Composer<BotContext>();

// 1. Authentication — identify the caller
globalMiddleware.use(async (ctx, next) => {
  ctx.startedAt = Date.now();

  // Reject updates with no sender in private chats (edge cases: channel posts, etc.)
  if (ctx.chat?.type === "private" && !ctx.from) {
    return; // drop silently
  }

  await next();
});

// 2. Authorization — set permission flags used by every feature
globalMiddleware.use(async (ctx, next) => {
  ctx.isOwner      = ctx.from?.id === config.OWNER_ID;
  ctx.isRegistered = !!ctx.from;
  await next();
});

// 3. Context Builder — hydrate user record into persistent storage
globalMiddleware.use(async (ctx, next) => {
  if (ctx.from) {
    await upsertUser(ctx.from);
  }
  await next();
});

// 4. Audit — record every update
globalMiddleware.use(async (ctx, next) => {
  const updateType = Object.keys(ctx.update).find((k) => k !== "update_id") ?? "unknown";
  const command    = ctx.message?.text?.split(" ")[0] ?? undefined;

  await appendAudit({
    updateId:   ctx.update.update_id,
    updateType,
    userId:     ctx.from?.id,
    chatId:     ctx.chat?.id,
    action:     command ?? updateType,
  });

  console.log(
    `[Audit] #${ctx.update.update_id} ${updateType}` +
    (ctx.from ? ` user=${ctx.from.id}` : "") +
    (command  ? ` cmd=${command}`       : ""),
  );

  await next();
});

// 5. Analytics — track active users and command usage
globalMiddleware.use(async (ctx, next) => {
  if (ctx.from) {
    await trackActiveUser(ctx.from.id);
  }

  const command = ctx.message?.text?.match(/^\/(\w+)/)?.[1];
  if (command) {
    await trackCommand(command);
  }

  await next();
});
