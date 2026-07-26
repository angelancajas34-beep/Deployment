// ─── Database ─────────────────────────────────────────────────────────────────
// One Deno KV instance shared across the entire runtime.
// Import { db, keys } in any feature or service.

export const db = await Deno.openKv();

// ─── Key Namespaces ───────────────────────────────────────────────────────────

export const keys = {
  // Users
  user:           (userId: number)                  => ["users", userId] as Deno.KvKey,

  // Community
  member:         (chatId: number, userId: number)  => ["members", chatId, userId] as Deno.KvKey,
  banned:         (chatId: number, userId: number)  => ["banned",  chatId, userId] as Deno.KvKey,

  // Support
  ticket:         (ticketId: string)                => ["tickets",     ticketId] as Deno.KvKey,
  userTicket:     (userId: number)                  => ["user_ticket", userId]   as Deno.KvKey,
  ownerReply:     ()                                => ["owner_reply_target"]    as Deno.KvKey,

  // Content
  post:           (postId: string)                  => ["posts",     postId] as Deno.KvKey,
  scheduled:      (postId: string)                  => ["scheduled", postId] as Deno.KvKey,

  // Broadcast
  broadcastJob:   (jobId: string)                   => ["broadcast_jobs", jobId] as Deno.KvKey,

  // Audit
  auditLog:       (ts: string)                      => ["audit", ts] as Deno.KvKey,

  // Analytics
  dailyActive:    (date: string)                    => ["analytics", "dau", date] as Deno.KvKey,
  commandCount:   (command: string)                 => ["analytics", "commands", command] as Deno.KvKey,
} as const;

// ─── Typed Helpers ────────────────────────────────────────────────────────────

export async function getOrNull<T>(key: Deno.KvKey): Promise<T | null> {
  const entry = await db.get<T>(key);
  return entry.value;
}

export async function listAll<T>(prefix: Deno.KvKey): Promise<T[]> {
  const results: T[] = [];
  for await (const entry of db.list<T>({ prefix })) {
    results.push(entry.value);
  }
  return results;
}
