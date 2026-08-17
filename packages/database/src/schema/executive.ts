import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { onboardingStatusEnum } from "./enums.js";

// Field list per VEX-OS-SRS-001 §5.1 / CLAUDE.md "Key Data Entities".
export const executives = pgTable("executives", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  organization: text("organization"),
  title: text("title"),
  domain: text("domain"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  onboardingStatus: onboardingStatusEnum("onboarding_status").notNull().default("not_started"),
  // FK to voice_profiles added via voice-profile.ts to avoid a circular
  // module import; see voiceProfileId column there and the relations file.
  voiceProfileId: uuid("voice_profile_id"),
  preferences: jsonb("preferences").notNull().default({}),
  // Added Sprint 3 (migration 0005): MB-01 requires generating each
  // executive's morning brief "by 06:00 executive local time" - a per-user
  // IANA zone name (e.g. "America/Regina"), not derivable from anything
  // else on this row. Defaults to UTC since onboarding doesn't currently
  // ask for it (see question-bank.ts) - a real gap, not a design choice;
  // noted in domains/morning-brief/schedule-briefs.ts where it actually
  // matters.
  timezone: text("timezone").notNull().default("UTC"),
});
