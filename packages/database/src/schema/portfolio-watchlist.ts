import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { executives } from "./executive.js";

// Manual watchlist for the morning brief's Portfolio section - deliberately
// not brokerage-integrated tracking (no quantity/cost-basis fields): the
// executive just names tickers they want a price/change summary on. See
// packages/integrations/src/market-data/client.ts for where these get
// resolved into actual quotes.
export const portfolioWatchlistItems = pgTable("portfolio_watchlist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  executiveId: uuid("executive_id")
    .notNull()
    .references(() => executives.id, { onDelete: "cascade" }),
  ticker: text("ticker").notNull(),
  label: text("label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
