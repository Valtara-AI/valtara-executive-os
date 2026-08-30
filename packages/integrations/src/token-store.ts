// Shared by every adapter: encrypted token persistence against
// integration_tokens (packages/database's crypto.ts, AES-256-GCM keyed by
// DB_ENCRYPTION_KEY - SEC-001 §4.1). No adapter touches the raw column
// values directly; they go through here so encryption isn't something
// each adapter has to remember to do correctly on its own.

import { and, eq } from "drizzle-orm";
import { getDb, schema, encryptField, decryptField } from "@nyxor/database";
import type { OAuthTokenSet } from "./types.js";

export async function saveTokens(
  executiveId: string,
  provider: string,
  tokens: OAuthTokenSet,
): Promise<void> {
  const db = getDb();
  const values = {
    executiveId,
    provider,
    accessTokenEncrypted: encryptField(tokens.accessToken),
    refreshTokenEncrypted: tokens.refreshToken ? encryptField(tokens.refreshToken) : null,
    scopes: tokens.scopes,
    expiresAt: tokens.expiresAt,
  };

  const [existing] = await db
    .select({ id: schema.integrationTokens.id })
    .from(schema.integrationTokens)
    .where(
      and(
        eq(schema.integrationTokens.executiveId, executiveId),
        eq(schema.integrationTokens.provider, provider),
      ),
    );

  if (existing) {
    await db
      .update(schema.integrationTokens)
      .set(values)
      .where(eq(schema.integrationTokens.id, existing.id));
  } else {
    await db.insert(schema.integrationTokens).values(values);
  }
}

export interface StoredTokens {
  accessToken: string;
  refreshToken: string | undefined;
  scopes: string[];
  expiresAt: Date | null;
}

export async function getTokens(
  executiveId: string,
  provider: string,
): Promise<StoredTokens | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schema.integrationTokens)
    .where(
      and(
        eq(schema.integrationTokens.executiveId, executiveId),
        eq(schema.integrationTokens.provider, provider),
      ),
    );
  if (!row) return undefined;

  return {
    accessToken: decryptField(row.accessTokenEncrypted),
    refreshToken: row.refreshTokenEncrypted ? decryptField(row.refreshTokenEncrypted) : undefined,
    scopes: row.scopes as string[],
    expiresAt: row.expiresAt,
  };
}

export async function deleteTokens(executiveId: string, provider: string): Promise<void> {
  const db = getDb();
  await db
    .delete(schema.integrationTokens)
    .where(
      and(
        eq(schema.integrationTokens.executiveId, executiveId),
        eq(schema.integrationTokens.provider, provider),
      ),
    );
}

/** Access token expires within the next 2 minutes (or has no expiry recorded, which shouldn't happen for a real OAuth token but is treated as "needs refresh" defensively). */
export function needsRefresh(tokens: StoredTokens): boolean {
  if (!tokens.expiresAt) return true;
  return tokens.expiresAt.getTime() - Date.now() < 2 * 60 * 1000;
}
