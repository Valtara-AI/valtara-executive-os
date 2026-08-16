import { date, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { executives } from "./executive";

// SRS §5.1: id, executive_id, date, content, sections_json, generated_at,
// read_at. Sprint 2+ scope (morning brief generation); table modeled now
// per the Sprint 1 plan's "model all ten entities now" decision.
export const morningBriefs = pgTable("morning_briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  executiveId: uuid("executive_id")
    .notNull()
    .references(() => executives.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  content: text("content").notNull(),
  sectionsJson: jsonb("sections_json").notNull().default({}),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
});
