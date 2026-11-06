/**
 * Last-known partner link for offline Pair chrome (Planner / Stats chips).
 * Never invents a partner — only mirrors what partner_get_link returned online.
 */
import type { PartnerLink } from '@/lib/partner';

import type { SqlExecutor, SqlValue } from './schema';

export type PartnerCacheRow = {
  user_id: string;
  partner_id: string | null;
  partner_display_name: string | null;
  status: string;
  saved_at: string;
};

const UPSERT_SQL = `
INSERT INTO partner_cache (
  user_id, partner_id, partner_display_name, status, saved_at
) VALUES (?, ?, ?, ?, ?)
ON CONFLICT(user_id) DO UPDATE SET
  partner_id = excluded.partner_id,
  partner_display_name = excluded.partner_display_name,
  status = excluded.status,
  saved_at = excluded.saved_at
`;

export async function savePartnerCache(
  db: SqlExecutor,
  userId: string,
  link: PartnerLink | null
): Promise<void> {
  const savedAt = new Date().toISOString();
  if (!link) {
    await db.run(UPSERT_SQL, [userId, null, null, 'none', savedAt]);
    return;
  }
  await db.run(UPSERT_SQL, [
    userId,
    link.partnerId,
    link.partnerDisplayName,
    link.status,
    savedAt,
  ]);
}

export async function readPartnerCache(
  db: SqlExecutor,
  userId: string
): Promise<PartnerLink | null> {
  const row = await db.first<Record<string, unknown>>(
    `SELECT * FROM partner_cache WHERE user_id = ?`,
    [userId]
  );
  if (!row) return null;
  const status = String(row.status);
  if (status !== 'pending' && status !== 'active') {
    return null;
  }
  return {
    id: `cache:${userId}`,
    status,
    inviteCode: null,
    isCreator: false,
    partnerId: row.partner_id == null ? null : String(row.partner_id),
    partnerDisplayName:
      row.partner_display_name == null
        ? null
        : String(row.partner_display_name),
    createdAt: String(row.saved_at),
    linkedAt: status === 'active' ? String(row.saved_at) : null,
  };
}

export async function clearPartnerCache(
  db: SqlExecutor,
  userId: string
): Promise<void> {
  await db.run('DELETE FROM partner_cache WHERE user_id = ?', [userId]);
}

/** @internal test helper */
export function partnerCacheParams(row: PartnerCacheRow): SqlValue[] {
  return [
    row.user_id,
    row.partner_id,
    row.partner_display_name,
    row.status,
    row.saved_at,
  ];
}
