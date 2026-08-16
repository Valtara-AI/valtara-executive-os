import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { agents } from "./agent.js";
import { hitlQueueItems } from "./hitl-queue-item.js";

// The concrete database expression of DL-ARCH-005 ("no agent may trigger an
// external action without an approved HITL record — enforced at the
// application layer, cannot be bypassed"). Not in SRS §5.1's entity list —
// this table exists purely as an enforcement mechanism.
//
// Any code path that performs an externally-visible side effect (send
// email, post to Slack, create/update a calendar event, etc.) must first
// insert a row here. hitl_queue_item_id is NOT NULL, which proves *some*
// HITL record is linked — but a plain foreign key can't express "and that
// record must be approved." That gap is closed by a Postgres BEFORE INSERT
// trigger (see src/migrations — hand-authored SQL, the one deliberate
// exception to CLAUDE.md's "no raw SQL without Engineering Lead approval",
// justified because it is the literal mechanism SEC-001 §2 names:
// "database constraint requires approved HITL record before external
// action"). Insert this row from within the same transaction that performs
// the external side effect so a failed side effect doesn't leave an orphan
// external_actions row (or vice versa).
export const externalActions = pgTable("external_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  actionType: text("action_type").notNull(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "restrict" }),
  hitlQueueItemId: uuid("hitl_queue_item_id")
    .notNull()
    .references(() => hitlQueueItems.id, { onDelete: "restrict" }),
  executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
});
