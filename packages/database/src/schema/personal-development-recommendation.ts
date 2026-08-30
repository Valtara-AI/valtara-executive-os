import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { executives } from "./executive.js";
import { personalDevRecommendationTypeEnum, personalDevRecommendationStatusEnum } from "./enums.js";

// No backing `agents` row by design: this is a platform-level recurring
// feature (same category as morning briefs), not a delegable "hire this
// worker" concept the `agents` table models. Persisted as its own table
// (not a TaskOutput blob) because the executive needs to mutate individual
// items' status over time - a frozen text blob can't support that without
// re-parsing free text on every status change.
export const personalDevelopmentRecommendations = pgTable("personal_development_recommendations", {
  id: uuid("id").primaryKey().defaultRandom(),
  executiveId: uuid("executive_id")
    .notNull()
    .references(() => executives.id, { onDelete: "cascade" }),
  type: personalDevRecommendationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  creator: text("creator"),
  rationale: text("rationale").notNull(),
  status: personalDevRecommendationStatusEnum("status").notNull().default("suggested"),
  recommendedAt: timestamp("recommended_at", { withTimezone: true }).notNull().defaultNow(),
  statusUpdatedAt: timestamp("status_updated_at", { withTimezone: true }),
});
