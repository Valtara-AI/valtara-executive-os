import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { executives } from "./executive.js";

// SRS §5.1: id, executive_id, provider, access_token_encrypted,
// refresh_token_encrypted, scopes[], expires_at. Sprint 4+ scope (Gmail/
// Outlook/Calendar/Slack integrations); table modeled now per the Sprint 1
// plan's "model all ten entities now" decision. access_token_encrypted /
// refresh_token_encrypted are populated via packages/database/src/crypto.ts
// (AES-256-GCM, keyed by DB_ENCRYPTION_KEY) once integration adapters land.
export const integrationTokens = pgTable("integration_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  executiveId: uuid("executive_id")
    .notNull()
    .references(() => executives.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  scopes: jsonb("scopes").notNull().default([]),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});
