import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { taskStatusEnum } from "./enums.js";
import { agents } from "./agent.js";
import { executives } from "./executive.js";

// SRS §5.1: id, agent_id, executive_id, prompt, status, context_snapshot,
// created_at, completed_at, retry_count.
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  executiveId: uuid("executive_id")
    .notNull()
    .references(() => executives.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  status: taskStatusEnum("status").notNull().default("queued"),
  contextSnapshot: jsonb("context_snapshot"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  retryCount: integer("retry_count").notNull().default(0),
});
