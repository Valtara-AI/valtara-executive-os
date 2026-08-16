import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { onboardingStatusEnum } from "./enums";

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
});
