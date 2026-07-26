// ─── Analytics Service ────────────────────────────────────────────────────────
// Lightweight counters stored in Deno KV.
// Tracks daily active users and per-command usage.

import { db, keys } from "../database.ts";

function today(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function trackActiveUser(userId: number): Promise<void> {
  const key = [...keys.dailyActive(today()), userId] as Deno.KvKey;
  await db.set(key, true);
}

export async function trackCommand(command: string): Promise<void> {
  const key = keys.commandCount(command);
  const entry = await db.get<number>(key);
  await db.set(key, (entry.value ?? 0) + 1);
}

export async function getDailyActiveCount(): Promise<number> {
  let count = 0;
  for await (const _ of db.list({ prefix: keys.dailyActive(today()) })) count++;
  return count;
}

export async function getCommandStats(): Promise<Record<string, number>> {
  const stats: Record<string, number> = {};
  for await (const entry of db.list<number>({ prefix: ["analytics", "commands"] })) {
    const command = (entry.key as string[])[2];
    stats[command] = entry.value;
  }
  return stats;
}
