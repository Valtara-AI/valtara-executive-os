import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { agentStatusEnum, hitlModeEnum } from "./enums";
import { executives } from "./executive";

// SRS §5.1: id, executive_id, name, description, responsibilities[],
// hitl_mode, status, created_at, updated_at.
export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  executiveId: uuid("executive_id")
    .notNull()
    .references(() => executives.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  responsibilities: jsonb("responsibilities").notNull().default([]),
  hitlMode: hitlModeEnum("hitl_mode").notNull().default("auto_draft_review"),
  status: agentStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
