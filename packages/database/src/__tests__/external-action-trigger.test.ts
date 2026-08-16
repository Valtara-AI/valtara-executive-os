// Verifies the concrete DB-level expression of DL-ARCH-005 (see
// src/migrations/0001_hitl_enforcement.sql): inserting into external_actions
// against a *pending* HITL item must be rejected by the trigger, and must
// succeed once that item is *approved*. This is the single most important
// test in the Sprint 1 plan — it's the proof that "no agent may trigger an
// external action without an approved HITL record" is structurally
// enforced, not just documented.
//
// Requires a live Postgres with migrations applied (docker-compose up -d &&
// npm run db:migrate --workspace=packages/database). Skipped otherwise so
// `npm run test` doesn't fail in environments without Docker.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../client";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("external_actions HITL enforcement trigger", () => {
  // getDb() throws if DATABASE_URL is unset, so it must stay inside a
  // beforeAll/it callback (lazy, skipped along with the tests) rather than
  // the describe body itself (which vitest always executes during
  // collection, even under skipIf - that's what "0 test" + a thrown error
  // instead of a clean skip actually means).
  let db: ReturnType<typeof getDb>;
  let executiveId: string;
  let agentId: string;

  beforeAll(async () => {
    db = getDb();
    const [executive] = await db
      .insert(schema.executives)
      .values({ name: "Test Exec", email: `test-${Date.now()}@example.com` })
      .returning();
    executiveId = executive!.id;

    const [agent] = await db
      .insert(schema.agents)
      .values({
        executiveId,
        name: "Test Agent",
        description: "Trigger test fixture",
      })
      .returning();
    agentId = agent!.id;
  });

  afterAll(async () => {
    await db.delete(schema.executives).where(eq(schema.executives.id, executiveId));
  });

  it("rejects an external_action linked to a pending HITL item", async () => {
    const [pendingItem] = await db
      .insert(schema.hitlQueueItems)
      .values({
        executiveId,
        status: "pending",
        originalOutput: "Draft email to board",
      })
      .returning();

    await expect(
      db.insert(schema.externalActions).values({
        actionType: "send_email",
        agentId,
        hitlQueueItemId: pendingItem!.id,
      }),
    ).rejects.toThrow(/not approved/i);
  });

  it("allows an external_action once the HITL item is approved", async () => {
    const [approvedItem] = await db
      .insert(schema.hitlQueueItems)
      .values({
        executiveId,
        status: "approved",
        originalOutput: "Draft email to board",
        finalOutput: "Draft email to board",
        actionedAt: new Date(),
        actionedBy: executiveId,
      })
      .returning();

    const [action] = await db
      .insert(schema.externalActions)
      .values({
        actionType: "send_email",
        agentId,
        hitlQueueItemId: approvedItem!.id,
      })
      .returning();

    expect(action?.id).toBeDefined();
  });

  it("rejects an external_action referencing a nonexistent HITL item", async () => {
    await expect(
      db.insert(schema.externalActions).values({
        actionType: "send_email",
        agentId,
        hitlQueueItemId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toThrow(/does not reference/i);
  });
});
