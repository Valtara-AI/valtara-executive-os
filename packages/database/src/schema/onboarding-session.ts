import { integer, jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { onboardingSessionStatusEnum } from "./enums.js";
import { executives } from "./executive.js";

// Not in SRS §5.1's entity list, but required to make OA-SYS-01's "stateful
// multi-turn conversation" requirement concrete and durable across server
// restarts, and to support re-onboarding version history (OA-SYS-05).
// Postgres-backed rather than Redis-backed: sessions need to survive
// restarts and eventually link to the profile/voice/agent rows they
// produce.
//
// executive_id is nullable because a session starts before the interview
// necessarily knows/has created the full Executive record in some flows
// (e.g. first-ever login); it's set once the executive identity is
// resolved.
export const onboardingSessions = pgTable("onboarding_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  executiveId: uuid("executive_id").references(() => executives.id, { onDelete: "cascade" }),
  state: jsonb("state").notNull().default({}),
  currentQuestionIndex: integer("current_question_index").notNull().default(0),
  status: onboardingSessionStatusEnum("status").notNull().default("in_progress"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
