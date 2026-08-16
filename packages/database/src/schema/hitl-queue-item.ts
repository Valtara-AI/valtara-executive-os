import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { hitlStatusEnum } from "./enums.js";
import { taskOutputs } from "./task-output.js";
import { executives } from "./executive.js";

// SRS §5.1: id, task_output_id, executive_id, status, original_output,
// final_output, rejection_reason, actioned_at, actioned_by.
//
// task_output_id is nullable: Sprint 1's onboarding flow can produce HITL
// items (e.g. the proposed agent workforce) that aren't yet backed by a
// Task/TaskOutput pair, since the general agent task execution engine is
// Sprint 2+ scope.
export const hitlQueueItems = pgTable("hitl_queue_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskOutputId: uuid("task_output_id").references(() => taskOutputs.id, { onDelete: "cascade" }),
  executiveId: uuid("executive_id")
    .notNull()
    .references(() => executives.id, { onDelete: "cascade" }),
  status: hitlStatusEnum("status").notNull().default("pending"),
  originalOutput: text("original_output").notNull(),
  finalOutput: text("final_output"),
  rejectionReason: text("rejection_reason"),
  actionedAt: timestamp("actioned_at", { withTimezone: true }),
  actionedBy: uuid("actioned_by").references(() => executives.id),
});
