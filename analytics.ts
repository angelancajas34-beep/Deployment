// ─── Audit Service ────────────────────────────────────────────────────────────
// Append-only log stored in Deno KV.
// Every update flowing through the bot writes one record here.

import { db, keys } from "../database.ts";
import { timestamp } from "../utils/id.ts";

export interface AuditRecord {
  ts:         string;
  updateId:   number;
  updateType: string;
  userId:     number | undefined;
  chatId:     number | undefined;
  action:     string;
  detail?:    string;
}

export async function appendAudit(record: Omit<AuditRecord, "ts">): Promise<void> {
  const ts = timestamp();
  await db.set(keys.auditLog(ts), { ts, ...record });
}

export async function recentAuditLogs(limit = 20): Promise<AuditRecord[]> {
  const all: AuditRecord[] = [];
  for await (const entry of db.list<AuditRecord>({ prefix: ["audit"] }, { limit, reverse: true })) {
    all.push(entry.value);
  }
  return all;
}
