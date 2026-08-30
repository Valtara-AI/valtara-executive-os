// Resolves the Executive DB row for an authenticated JWT subject, creating
// one on first access. NextAuth (apps/web) is the identity issuer; this is
// where that identity gets a corresponding row in NYXOR's own domain data.

import { eq } from "drizzle-orm";
import { getDb, schema } from "@nyxor/database";
import type { JwtPayload } from "@nyxor/shared";

export async function resolveExecutive(user: JwtPayload): Promise<{ id: string }> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(schema.executives)
    .where(eq(schema.executives.email, user.email));
  if (existing) return { id: existing.id };

  const [created] = await db
    .insert(schema.executives)
    .values({ name: user.email, email: user.email, onboardingStatus: "not_started" })
    .returning();
  if (!created) throw new Error("Failed to create executive record.");

  return { id: created.id };
}
