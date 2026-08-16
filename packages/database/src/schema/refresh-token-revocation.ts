import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

// SEC-001 §3.1: "Refresh token: ... server-side revocation table checked on
// use." Not in SRS §5.1's entity list — a security-layer table, not a
// product-data entity.
export const refreshTokenRevocations = pgTable("refresh_token_revocations", {
  tokenId: uuid("token_id").primaryKey(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }).notNull().defaultNow(),
});
