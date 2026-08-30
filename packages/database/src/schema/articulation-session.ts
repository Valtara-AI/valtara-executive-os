import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { executives } from "./executive.js";
import { articulationSessionTypeEnum, articulationInputModeEnum } from "./enums.js";

// No backing `agents` row, no Task/HITL pipeline - same reasoning as
// personal-development-recommendation.ts: this is purely internal feedback
// (shown only to its own author, never sent externally), so it never
// touches external_actions, and there's no delegation concept to model via
// `agents`. Flat score columns (not just feedbackJson) so a trend query is
// a plain indexed scan instead of a jsonb-path extraction - same "flat
// columns + jsonb bag for the rest" split morningBriefs.content+sectionsJson
// already uses.
export const articulationSessions = pgTable("articulation_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  executiveId: uuid("executive_id")
    .notNull()
    .references(() => executives.id, { onDelete: "cascade" }),
  sessionType: articulationSessionTypeEnum("session_type").notNull(),
  inputMode: articulationInputModeEnum("input_mode").notNull(),
  // Populated directly for text mode, or with the Whisper transcript for
  // audio mode - downstream code (analyzeSpeech) never branches on
  // inputMode to get "the text to analyze."
  inputText: text("input_text").notNull(),
  // Storage path, not a URL - the recording bucket is private
  // (packages/integrations/src/audio-storage/client.ts), so there's no
  // permanent public link to store. Playback access is a short-lived
  // signed URL generated on demand from this path.
  audioStoragePath: text("audio_storage_path"),
  audioDurationSeconds: integer("audio_duration_seconds"),
  feedbackJson: jsonb("feedback_json").notNull(),
  clarityScore: integer("clarity_score").notNull(),
  structureScore: integer("structure_score").notNull(),
  persuasivenessScore: integer("persuasiveness_score").notNull(),
  toneScore: integer("tone_score").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
