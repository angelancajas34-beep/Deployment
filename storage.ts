// ─── Storage Service ──────────────────────────────────────────────────────────
// Manages the persistent user record written on every interaction.

import { db, keys, listAll } from "../database.ts";

export interface UserRecord {
  id:         number;
  first_name: string;
  last_name?: string;
  username?:  string;
  is_bot:     boolean;
  created_at: string;
  last_seen:  string;
  message_count: number;
}

export async function upsertUser(
  from: { id: number; first_name: string; last_name?: string; username?: string; is_bot: boolean },
): Promise<void> {
  const key = keys.user(from.id);
  const existing = await db.get<UserRecord>(key);

  await db.set(key, {
    id:            from.id,
    first_name:    from.first_name,
    last_name:     from.last_name,
    username:      from.username,
    is_bot:        from.is_bot,
    created_at:    existing.value?.created_at ?? new Date().toISOString(),
    last_seen:     new Date().toISOString(),
    message_count: (existing.value?.message_count ?? 0) + 1,
  } satisfies UserRecord);
}

export async function getUser(userId: number): Promise<UserRecord | null> {
  const entry = await db.get<UserRecord>(keys.user(userId));
  return entry.value;
}

export async function getAllUsers(): Promise<UserRecord[]> {
  return listAll<UserRecord>(["users"]);
}

export async function getUserCount(): Promise<number> {
  let count = 0;
  for await (const _ of db.list({ prefix: ["users"] })) count++;
  return count;
}
