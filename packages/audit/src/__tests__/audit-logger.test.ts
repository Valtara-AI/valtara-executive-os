// Requires a live Postgres with migrations applied. Skipped otherwise (see
// packages/database's external-action-trigger.test.ts for the same
// pattern).

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AuditLogger } from "../audit-logger";

const hasDb = Boolean(process.env.DATABASE_URL);

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

describe.skipIf(!hasDb)("AuditLogger chain integrity", () => {
  it("chains record_hash across three sequential writes", async () => {
    const logger = new AuditLogger();
    const entityId = crypto.randomUUID();

    const first = await logger.log({
      actorId: entityId,
      actorRole: "Executive",
      entityType: "test",
      entityId,
      action: "step_1",
    });
    const second = await logger.log({
      actorId: entityId,
      actorRole: "Executive",
      entityType: "test",
      entityId,
      action: "step_2",
    });
    const third = await logger.log({
      actorId: entityId,
      actorRole: "Executive",
      entityType: "test",
      entityId,
      action: "step_3",
    });

    // Each entry's prevHash must equal the immediately preceding entry's recordHash.
    expect(second.prevHash).toBe(first.recordHash);
    expect(third.prevHash).toBe(second.recordHash);

    // The chain is verifiable independently of the class's internals: given
    // prevHash + the same payload shape, recomputing record_hash by hand
    // must reproduce what was stored.
    const expectedSecondHash = sha256(
      (second.prevHash ?? "") +
        JSON.stringify({
          actorId: second.actorId,
          actorRole: second.actorRole,
          entityType: second.entityType,
          entityId: second.entityId,
          action: second.action,
          inputHash: second.inputHash,
          outputHash: second.outputHash,
          metadata: second.metadata,
        }),
    );
    expect(second.recordHash).toBe(expectedSecondHash);
  });

  it("hashes input/output rather than storing them raw", async () => {
    const logger = new AuditLogger();
    const entityId = crypto.randomUUID();
    const input = { prompt: "sensitive draft content" };

    const entry = await logger.log({
      actorId: entityId,
      actorRole: "Executive",
      entityType: "test",
      entityId,
      action: "with_payload",
      input,
    });

    expect(entry.inputHash).toBe(sha256(JSON.stringify(input)));
    expect(entry.inputHash).not.toContain("sensitive draft content");
  });
});
