import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { hitlStatusEnum } from "./enums";
import { tasks } from "./task";

// SRS §5.1: id, task_id, model_provider, model_id, prompt_version,
// output_text, tokens_input, tokens_output, duration_ms, hitl_status,
// created_at.
export const taskOutputs = pgTable("task_outputs", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  modelProvider: text("model_provider").notNull(),
  modelId: text("model_id").notNull(),
  promptVersion: text("prompt_version").notNull(),
  outputText: text("output_text").notNull(),
  tokensInput: integer("tokens_input").notNull(),
  tokensOutput: integer("tokens_output").notNull(),
  durationMs: integer("duration_ms").notNull(),
  hitlStatus: hitlStatusEnum("hitl_status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
