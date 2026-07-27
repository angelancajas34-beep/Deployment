// ─── middleware.ts ─────────────────────────────────────────────────────────
// Extends grammY's Context with runtime fields and wires the global
// middleware pipeline: Authentication → Authorization → Context Builder
// → Audit → Analytics.

import { Composer, Context } from "https://deno.land/x/grammy@v1.36.1/mod.ts";
import { config } from "./config.ts";
import { logAudit } from "./audit.ts";
import { trackActiveUser, trackCommand } from "./analytics.ts";
import { upsertUser } from "./storage.ts";

export interface BotContext extends Context {
  isOwner: boolean;
  isRegistered: boolean;
  startedAt: number;
}

export const globalMiddleware = new Composer<BotContext>();

// ── Authentication + Authorization + Context Builder ───────────────────────
globalMiddleware.use(async (ctx, next) => {
  ctx.startedAt = Date.now();
  ctx.isRegistered = ctx.from !== undefined;
  ctx.isOwner = ctx.from?.id === config.OWNER_ID;
  await next();
});

// ── Registration (upsert user record) ──────────────────────────────────────
globalMiddleware.use(async (ctx, next) => {
  if (ctx.from) {
    await upsertUser({
      id: ctx.from.id,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastSeen: Date.now(),
    });
  }
  await next();
});

// ── Audit ────────────────────────────────────────────────────────────────
globalMiddleware.use(async (ctx, next) => {
  await logAudit({
    updateId: ctx.update.update_id,
    userId: ctx.from?.id,
    type: ctx.updateType,
  });
  await next();
});

// ── Analytics ────────────────────────────────────────────────────────────
globalMiddleware.use(async (ctx, next) => {
  if (ctx.from) {
    await trackActiveUser(ctx.from.id);
  }
  const text = ctx.message?.text;
  if (text?.startsWith("/")) {
    const command = text.split(" ")[0].slice(1).split("@")[0];
    await trackCommand(command);
  }
  await next(
    
  );
});
