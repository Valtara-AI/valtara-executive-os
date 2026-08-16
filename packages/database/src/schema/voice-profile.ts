import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { executives } from "./executive";

// SRS §5.1: id, executive_id, version, tone, formality, sentence_length,
// vocabulary_level, salutations, structural_preferences, created_at.
export const voiceProfiles = pgTable("voice_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  executiveId: uuid("executive_id")
    .notNull()
    .references(() => executives.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  tone: text("tone"),
  formality: text("formality"),
  sentenceLength: text("sentence_length"),
  vocabularyLevel: text("vocabulary_level"),
  salutations: jsonb("salutations").notNull().default([]),
  structuralPreferences: jsonb("structural_preferences").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
