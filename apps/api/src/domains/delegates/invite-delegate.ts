// Executive-initiated invite. Idempotent: re-inviting an email that's
// already pending/accepted is a no-op returning the existing row; re-
// inviting one that was declined/revoked resets it to pending (a natural
// "try again" without needing a separate reinstate endpoint).

import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function inviteDelegate(executiveId: string, rawEmail: string) {
  const db = getDb();
  const delegateEmail = normalizeEmail(rawEmail);

  const [existing] = await db
    .select()
    .from(schema.delegateLinks)
    .where(
      and(
        eq(schema.delegateLinks.executiveId, executiveId),
        eq(schema.delegateLinks.delegateEmail, delegateEmail),
      ),
    );

  if (existing) {
    if (existing.status === "pending" || existing.status === "accepted") {
      return existing;
    }
    const [reinstated] = await db
      .update(schema.delegateLinks)
      .set({ status: "pending", invitedAt: new Date(), respondedAt: null, revokedAt: null })
      .where(eq(schema.delegateLinks.id, existing.id))
      .returning();
    if (!reinstated) throw new Error("Failed to reinstate delegate invitation.");
    return reinstated;
  }

  const [created] = await db
    .insert(schema.delegateLinks)
    .values({ executiveId, delegateEmail, status: "pending" })
    .returning();
  if (!created) throw new Error("Failed to create delegate invitation.");
  return created;
}
