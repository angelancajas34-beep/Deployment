// ─── ID Generation ────────────────────────────────────────────────────────────

export function generateId(prefix: string): string {
  const ts  = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${ts}-${rnd}`;
}

export function timestamp(): string {
  return new Date().toISOString();
}
