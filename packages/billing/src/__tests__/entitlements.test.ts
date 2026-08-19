// Requires a live Postgres. Proves the actual gating behavior DL-ARCH-010
// exists for: no subscription row means zero entitlements (not "assume a
// free tier"), and each assert* function throws once its resource count
// reaches the tier's limit - not "unlimited by default" if something is
// left unwired.

import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@vex-os/database";
import {
  assertAgentLimit,
  assertIntegrationAllowed,
  assertSeatLimit,
  EntitlementError,
  getEntitlements,
} from "../entitlements.js";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("entitlements", () => {
  const cleanupExecutiveIds: string[] = [];

  afterEach(async () => {
    const db = getDb();
    for (const id of cleanupExecutiveIds.splice(0)) {
      await db.delete(schema.agents).where(eq(schema.agents.executiveId, id));
      await db.delete(schema.delegateLinks).where(eq(schema.delegateLinks.executiveId, id));
      await db.delete(schema.subscriptions).where(eq(schema.subscriptions.executiveId, id));
      await db.delete(schema.executives).where(eq(schema.executives.id, id));
    }
  });

  async function makeExecutive() {
    const db = getDb();
    const [executive] = await db
      .insert(schema.executives)
      .values({
        name: "Billing Test Exec",
        email: `billing-test-${Date.now()}-${Math.random()}@example.com`,
      })
      .returning();
    cleanupExecutiveIds.push(executive!.id);
    return executive!;
  }

  it("getEntitlements returns zero limits when no subscription row exists", async () => {
    const executive = await makeExecutive();
    const state = await getEntitlements(executive.id);
    expect(state).toEqual({
      tier: null,
      status: "none",
      limits: { maxAgents: 0, allowedIntegrations: [], maxDelegateSeats: 0, maxMonthlyTasks: 0 },
    });
  });

  it("assertAgentLimit throws for an executive with no subscription at all", async () => {
    const executive = await makeExecutive();
    await expect(assertAgentLimit(executive.id)).rejects.toThrow(EntitlementError);
  });

  it("assertIntegrationAllowed rejects a provider not in the starter tier's allowlist", async () => {
    const executive = await makeExecutive();
    const db = getDb();
    await db.insert(schema.subscriptions).values({
      executiveId: executive.id,
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: `sub_test_${Date.now()}`,
      tier: "starter",
      status: "active",
    });

    await expect(assertIntegrationAllowed(executive.id, "pandadoc")).rejects.toThrow(
      EntitlementError,
    );
    await expect(assertIntegrationAllowed(executive.id, "google")).resolves.toBeUndefined();
  });

  it("assertAgentLimit throws once the active-agent count reaches the tier limit", async () => {
    const executive = await makeExecutive();
    const db = getDb();
    await db.insert(schema.subscriptions).values({
      executiveId: executive.id,
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: `sub_test_${Date.now()}`,
      tier: "starter", // maxAgents: 3
      status: "trialing",
    });

    for (let i = 0; i < 3; i++) {
      await db.insert(schema.agents).values({
        executiveId: executive.id,
        name: `Agent ${i}`,
        description: "d",
        responsibilities: ["r"],
      });
    }

    await expect(assertAgentLimit(executive.id)).rejects.toThrow(/Agent limit reached/);
  });

  it("a past_due subscription grants zero entitlements, same as no subscription", async () => {
    const executive = await makeExecutive();
    const db = getDb();
    await db.insert(schema.subscriptions).values({
      executiveId: executive.id,
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: `sub_test_${Date.now()}`,
      tier: "pro",
      status: "past_due",
    });

    await expect(assertSeatLimit(executive.id)).rejects.toThrow(EntitlementError);
  });
});
