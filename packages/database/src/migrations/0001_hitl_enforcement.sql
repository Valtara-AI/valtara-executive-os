-- Custom SQL migration file, put your code below! --

-- Hand-authored migration. Deliberate exception to CLAUDE.md's "no raw SQL
-- without Engineering Lead approval" — Drizzle's schema DSL has no
-- first-class support for triggers or row-level security policies, and both
-- of the following are literal enforcement mechanisms named in the
-- governance docs, not stylistic raw-SQL usage:
--
--   1. DL-ARCH-005 / SEC-001 §2: "database constraint requires approved
--      HITL record before external action." A NOT NULL foreign key on
--      external_actions.hitl_queue_item_id (already in 0000) only proves
--      *some* HITL record is linked — this trigger additionally requires
--      that record's status to be 'approved' at insert time, closing the
--      gap a foreign key alone cannot express.
--
--   2. SEC-001 §6 "Immutability": "Audit log table: row-level security
--      disables UPDATE and DELETE for all roles including Administrator;
--      appends only."

CREATE OR REPLACE FUNCTION enforce_hitl_approval_before_external_action()
RETURNS TRIGGER AS $$
DECLARE
  item_status hitl_status;
BEGIN
  SELECT status INTO item_status
  FROM hitl_queue_items
  WHERE id = NEW.hitl_queue_item_id;

  IF item_status IS NULL THEN
    RAISE EXCEPTION 'external_actions.hitl_queue_item_id % does not reference an existing hitl_queue_items row', NEW.hitl_queue_item_id;
  END IF;

  IF item_status <> 'approved' THEN
    RAISE EXCEPTION 'Cannot record external_action: linked hitl_queue_items row % has status %, not approved (DL-ARCH-005)', NEW.hitl_queue_item_id, item_status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER trg_enforce_hitl_approval_before_external_action
BEFORE INSERT ON external_actions
FOR EACH ROW
EXECUTE FUNCTION enforce_hitl_approval_before_external_action();
--> statement-breakpoint

-- Audit log immutability (SEC-001 §6): append-only, no UPDATE/DELETE for any
-- role, including table owner/Administrator. FORCE ROW LEVEL SECURITY makes
-- this apply even to the table owner, which would otherwise bypass RLS by
-- default.
ALTER TABLE audit_log_entries ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE audit_log_entries FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY audit_log_insert_only ON audit_log_entries
  FOR INSERT
  WITH CHECK (true);
--> statement-breakpoint

CREATE POLICY audit_log_select_all ON audit_log_entries
  FOR SELECT
  USING (true);

-- No UPDATE or DELETE policy is created — with RLS enabled and forced, the
-- absence of a permissive policy for those commands means they are denied
-- outright for every role, satisfying "disables UPDATE and DELETE for all
-- roles including Administrator." Fine-grained SELECT scoping (SEC-001 §6
-- Access: "Executive can view own audit log; Administrator can export full
-- log; no other role has audit log access") is enforced in the application
-- layer's query filters in Sprint 1, not via RLS predicate — audit log
-- read-scoping by role is revisited if/when row-level executive_id scoping
-- is added directly to this table's RLS policy in a later sprint.