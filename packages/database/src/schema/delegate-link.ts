import { pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";
import { delegateInvitationStatusEnum } from "./enums.js";
import { executives } from "./executive.js";

// Executive-Delegate relationship (SRS/PRD §3.2), not in the original SRS
// §5.1 entity list. delegate_email rather than a delegate_id FK: a
// delegate may be invited before they've ever signed in (no Executive-like
// row exists for them - Delegates aren't onboarded, they don't get their
// own agent workforce), so email is the only stable identifier available
// at invite time. Matched case-insensitively against the JWT's email claim
// at read time (see resolve-accessible-executive-ids.ts) - always lowercase
// on write.
export const delegateLinks = pgTable(
  "delegate_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    executiveId: uuid("executive_id")
      .notNull()
      .references(() => executives.id, { onDelete: "cascade" }),
    delegateEmail: text("delegate_email").notNull(),
    status: delegateInvitationStatusEnum("status").notNull().default("pending"),
    invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [unique().on(table.executiveId, table.delegateEmail)],
);
