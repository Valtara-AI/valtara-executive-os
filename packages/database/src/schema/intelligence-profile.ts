import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { executives } from "./executive.js";

// SRS §5.1: id, executive_id, version, time_drains[], delegation_candidates[],
// communication_style, tools[], created_at.
export const executiveIntelligenceProfiles = pgTable("executive_intelligence_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  executiveId: uuid("executive_id")
    .notNull()
    .references(() => executives.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  timeDrains: jsonb("time_drains").notNull().default([]),
  delegationCandidates: jsonb("delegation_candidates").notNull().default([]),
  communicationStyle: text("communication_style"),
  tools: jsonb("tools").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
