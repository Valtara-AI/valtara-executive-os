// Manual ticker watchlist backing the morning brief's Portfolio section
// (packages/integrations/src/market-data/client.ts resolves these into
// quotes at brief-generation time - this route only manages the list
// itself). Executive-only, same reasoning as executive-profile.ts: a
// Delegate has no watchlist of their own to manage.

import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@nyxor/database";
import { fail, ok } from "@nyxor/shared";
import type { AuthedVariables } from "../middleware/jwt.js";
import { requireRole } from "../middleware/rbac.js";
import { resolveExecutive } from "../domains/onboarding/resolve-executive.js";

export const watchlistRoute = new Hono<{ Variables: AuthedVariables }>();

watchlistRoute.use("*", requireRole("Executive"));

const MAX_WATCHLIST_ITEMS = 20;

watchlistRoute.get("/", async (c) => {
  const { id } = await resolveExecutive(c.get("user"));
  const db = getDb();

  const items = await db
    .select()
    .from(schema.portfolioWatchlistItems)
    .where(eq(schema.portfolioWatchlistItems.executiveId, id));
  return c.json(ok(items));
});

const AddWatchlistItemSchema = z.object({
  ticker: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .transform((t) => t.toUpperCase()),
  label: z.string().trim().max(100).optional(),
});

watchlistRoute.post("/", async (c) => {
  const { id } = await resolveExecutive(c.get("user"));
  const db = getDb();

  const parsed = AddWatchlistItemSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      fail("VALIDATION_ERROR", "Invalid request body.", { issues: parsed.error.issues }),
      400,
    );
  }

  const existing = await db
    .select()
    .from(schema.portfolioWatchlistItems)
    .where(eq(schema.portfolioWatchlistItems.executiveId, id));
  if (existing.length >= MAX_WATCHLIST_ITEMS) {
    return c.json(
      fail("LIMIT_REACHED", `Watchlist is capped at ${MAX_WATCHLIST_ITEMS} tickers.`),
      400,
    );
  }
  if (existing.some((item) => item.ticker === parsed.data.ticker)) {
    return c.json(fail("DUPLICATE", `${parsed.data.ticker} is already on your watchlist.`), 400);
  }

  const [item] = await db
    .insert(schema.portfolioWatchlistItems)
    .values({ executiveId: id, ticker: parsed.data.ticker, label: parsed.data.label ?? null })
    .returning();
  return c.json(ok(item), 201);
});

watchlistRoute.delete("/:itemId", async (c) => {
  const { id } = await resolveExecutive(c.get("user"));
  const db = getDb();
  const itemId = c.req.param("itemId");

  const [deleted] = await db
    .delete(schema.portfolioWatchlistItems)
    .where(
      and(
        eq(schema.portfolioWatchlistItems.id, itemId),
        eq(schema.portfolioWatchlistItems.executiveId, id),
      ),
    )
    .returning();
  if (!deleted) {
    return c.json(fail("NOT_FOUND", "Watchlist item not found."), 404);
  }
  return c.json(ok(deleted));
});
