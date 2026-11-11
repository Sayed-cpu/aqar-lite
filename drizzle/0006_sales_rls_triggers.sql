-- Reservations, contracts, installments and payments: what the app role may
-- do, who sees which rows, and the rules every writer (the owner included)
-- is held to.
--
-- Lock order, everywhere a transaction takes more than one: unit, then
-- reservation, then contract. The expiry sweep only ever takes unit locks it
-- can get without waiting (SKIP LOCKED), so it never waits on anyone.

-- ─── Privileges ───────────────────────────────────────────────────────────
-- Nothing here is ever deleted, except a draft's schedule being replaced.
-- installments has no UPDATE at all: paid amounts move only through a
-- payment allocation (see payment_allocations_apply below).
GRANT SELECT, INSERT ON reservations, contracts, installments, payments, payment_allocations TO aqar_app;
--> statement-breakpoint
GRANT UPDATE (status, ended_at) ON reservations TO aqar_app;
--> statement-breakpoint
-- approved_at is not here: the trigger stamps it, so the app cannot pick it.
GRANT UPDATE (final_price_halalas, down_payment_halalas, installment_count, start_date, status, approved_by)
  ON contracts TO aqar_app;
--> statement-breakpoint
GRANT DELETE ON installments TO aqar_app;
--> statement-breakpoint

-- ─── Row-level security ───────────────────────────────────────────────────
-- Reads: the company, and inside it a rep sees only their own reservations
-- and contracts; schedules and payments inherit their contract's visibility
-- through the EXISTS, which is itself filtered by the contracts policy.
-- Writes: each one names the only role that makes it.
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY reservations_read ON reservations FOR SELECT
  USING (
    company_id = app_current_company_id()
    AND (
      app_current_role() IN ('manager', 'accountant')
      OR (app_current_role() = 'sales_rep' AND reserved_by = app_current_user_id())
    )
  );
--> statement-breakpoint
CREATE POLICY reservations_rep_reserves ON reservations FOR INSERT
  WITH CHECK (
    company_id = app_current_company_id()
    AND app_current_role() = 'sales_rep'
    AND reserved_by = app_current_user_id()
  );
--> statement-breakpoint
-- The app ends a reservation only by approving its contract. Expiry runs in
-- expire_due_reservations(), as the owner.
CREATE POLICY reservations_accountant_converts ON reservations FOR UPDATE
  USING (company_id = app_current_company_id() AND app_current_role() = 'accountant')
  WITH CHECK (company_id = app_current_company_id() AND app_current_role() = 'accountant');
--> statement-breakpoint
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY contracts_read ON contracts FOR SELECT
  USING (
    company_id = app_current_company_id()
    AND (
      app_current_role() IN ('manager', 'accountant')
      OR (app_current_role() = 'sales_rep' AND sales_rep_id = app_current_user_id())
    )
  );
--> statement-breakpoint
CREATE POLICY contracts_rep_drafts ON contracts FOR INSERT
  WITH CHECK (
    company_id = app_current_company_id()
    AND app_current_role() = 'sales_rep'
    AND sales_rep_id = app_current_user_id()
    AND status = 'draft'
  );
--> statement-breakpoint
-- A rep edits their own draft, and it is still a draft afterwards.
CREATE POLICY contracts_rep_edits_draft ON contracts FOR UPDATE
  USING (
    company_id = app_current_company_id()
    AND app_current_role() = 'sales_rep'
    AND sales_rep_id = app_current_user_id()
    AND status = 'draft'
  )
  WITH CHECK (
    company_id = app_current_company_id()
    AND app_current_role() = 'sales_rep'
    AND sales_rep_id = app_current_user_id()
    AND status = 'draft'
  );
--> statement-breakpoint
-- An accountant's only write is an approval in their own name. USING covers
-- approved rows too so a payment can lock its contract (SELECT ... FOR
-- UPDATE is checked against UPDATE policies); the trigger refuses any actual
-- change to an approved contract.
CREATE POLICY contracts_accountant_approves ON contracts FOR UPDATE
  USING (company_id = app_current_company_id() AND app_current_role() = 'accountant')
  WITH CHECK (
    company_id = app_current_company_id()
    AND app_current_role() = 'accountant'
    AND status = 'approved'
    AND approved_by = app_current_user_id()
  );
--> statement-breakpoint
ALTER TABLE installments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY installments_read ON installments FOR SELECT
  USING (
    company_id = app_current_company_id()
    AND EXISTS (SELECT 1 FROM contracts c WHERE c.id = installments.contract_id)
  );
--> statement-breakpoint
CREATE POLICY installments_rep_writes_draft_schedule ON installments FOR INSERT
  WITH CHECK (
    company_id = app_current_company_id()
    AND app_current_role() = 'sales_rep'
    AND EXISTS (
      SELECT 1 FROM contracts c
      WHERE c.id = installments.contract_id AND c.sales_rep_id = app_current_user_id() AND c.status = 'draft'
    )
  );
--> statement-breakpoint
CREATE POLICY installments_rep_replaces_draft_schedule ON installments FOR DELETE
  USING (
    company_id = app_current_company_id()
    AND app_current_role() = 'sales_rep'
    AND EXISTS (
      SELECT 1 FROM contracts c
      WHERE c.id = installments.contract_id AND c.sales_rep_id = app_current_user_id() AND c.status = 'draft'
    )
  );
--> statement-breakpoint
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY payments_read ON payments FOR SELECT
  USING (
    company_id = app_current_company_id()
    AND EXISTS (SELECT 1 FROM contracts c WHERE c.id = payments.contract_id)
  );
--> statement-breakpoint
CREATE POLICY payments_accountant_records ON payments FOR INSERT
  WITH CHECK (
    company_id = app_current_company_id()
    AND app_current_role() = 'accountant'
    AND recorded_by = app_current_user_id()
  );
--> statement-breakpoint
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY payment_allocations_read ON payment_allocations FOR SELECT
  USING (
    company_id = app_current_company_id()
    AND EXISTS (SELECT 1 FROM contracts c WHERE c.id = payment_allocations.contract_id)
  );
--> statement-breakpoint
CREATE POLICY payment_allocations_accountant_records ON payment_allocations FOR INSERT
  WITH CHECK (company_id = app_current_company_id() AND app_current_role() = 'accountant');
--> statement-breakpoint

-- ─── Reservations ─────────────────────────────────────────────────────────
-- active → expired   once its 72 hours are up (ended_at at or after expiry)
-- active → converted while it still holds the unit, once its contract is approved
-- An ended reservation never changes status again.
CREATE FUNCTION reservations_enforce_lifecycle() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'active' THEN
      RAISE EXCEPTION 'a new reservation must be active, not %', NEW.status USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF OLD.status <> 'active' THEN
    RAISE EXCEPTION 'a % reservation cannot become %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status = 'expired' AND NEW.ended_at < NEW.expires_at THEN
    RAISE EXCEPTION 'a reservation cannot expire before %', NEW.expires_at USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status = 'converted' THEN
    IF NEW.ended_at >= NEW.expires_at THEN
      RAISE EXCEPTION 'an expired reservation cannot be converted' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM contracts c WHERE c.reservation_id = NEW.id AND c.status = 'approved'
    ) THEN
      RAISE EXCEPTION 'a reservation is converted only by approving its contract' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER reservations_enforce_lifecycle
  BEFORE INSERT OR UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION reservations_enforce_lifecycle();
--> statement-breakpoint

-- ─── Contracts ────────────────────────────────────────────────────────────
-- Created as a draft. A draft's terms may change (revision counts each
-- change). Approval changes the status and nothing else, and only while the
-- reservation is still active. An approved contract never changes.
CREATE FUNCTION contracts_enforce_lifecycle() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION 'a new contract must be a draft, not %', NEW.status USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'approved' THEN
    RAISE EXCEPTION 'an approved contract cannot change' USING ERRCODE = 'check_violation';
  END IF;

  IF (NEW.company_id, NEW.reservation_id, NEW.unit_id, NEW.client_id, NEW.sales_rep_id, NEW.list_price_halalas)
     IS DISTINCT FROM
     (OLD.company_id, OLD.reservation_id, OLD.unit_id, OLD.client_id, OLD.sales_rep_id, OLD.list_price_halalas) THEN
    RAISE EXCEPTION 'a contract''s unit, client, rep and list price are fixed' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status = 'approved' THEN
    IF (NEW.final_price_halalas, NEW.down_payment_halalas, NEW.installment_count, NEW.start_date, NEW.revision)
       IS DISTINCT FROM
       (OLD.final_price_halalas, OLD.down_payment_halalas, OLD.installment_count, OLD.start_date, OLD.revision) THEN
      RAISE EXCEPTION 'approving a contract cannot also change its terms' USING ERRCODE = 'check_violation';
    END IF;
    NEW.approved_at := coalesce(NEW.approved_at, now());
    IF NOT EXISTS (
      SELECT 1 FROM reservations r
      WHERE r.id = NEW.reservation_id
        AND r.status = 'active'
        AND r.created_at <= NEW.approved_at
        AND r.expires_at > NEW.approved_at
    ) THEN
      RAISE EXCEPTION 'the reservation behind this contract is no longer active' USING ERRCODE = 'check_violation';
    END IF;
  ELSIF (NEW.final_price_halalas, NEW.down_payment_halalas, NEW.installment_count, NEW.start_date)
        IS DISTINCT FROM
        (OLD.final_price_halalas, OLD.down_payment_halalas, OLD.installment_count, OLD.start_date) THEN
    NEW.revision := OLD.revision + 1;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER contracts_enforce_lifecycle
  BEFORE INSERT OR UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION contracts_enforce_lifecycle();
--> statement-breakpoint

-- ─── Installments ─────────────────────────────────────────────────────────
-- A draft's schedule may be written and replaced; an approved one is fixed.
-- paid_halalas only grows, and only on an approved contract.
CREATE FUNCTION installments_enforce_lifecycle() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  parent_status contract_status;
BEGIN
  SELECT c.status INTO parent_status
  FROM contracts c
  WHERE c.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.contract_id ELSE NEW.contract_id END;

  IF TG_OP = 'DELETE' THEN
    IF parent_status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'the schedule of an approved contract cannot change' USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF parent_status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'the schedule of an approved contract cannot change' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.paid_halalas <> 0 THEN
      RAISE EXCEPTION 'a new installment starts unpaid' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF (NEW.company_id, NEW.contract_id, NEW.seq, NEW.due_date, NEW.amount_halalas)
     IS DISTINCT FROM (OLD.company_id, OLD.contract_id, OLD.seq, OLD.due_date, OLD.amount_halalas) THEN
    RAISE EXCEPTION 'an installment''s terms cannot change' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.paid_halalas < OLD.paid_halalas THEN
    RAISE EXCEPTION 'a payment cannot be undone' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.paid_halalas <> OLD.paid_halalas AND parent_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'only an approved contract takes payments' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER installments_enforce_lifecycle
  BEFORE INSERT OR UPDATE OR DELETE ON installments
  FOR EACH ROW EXECUTE FUNCTION installments_enforce_lifecycle();
--> statement-breakpoint

-- ─── Payments ─────────────────────────────────────────────────────────────
CREATE FUNCTION payments_require_approved_contract() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM contracts c WHERE c.id = NEW.contract_id AND c.status = 'approved') THEN
    RAISE EXCEPTION 'payments are recorded only against an approved contract' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER payments_require_approved_contract
  BEFORE INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION payments_require_approved_contract();
--> statement-breakpoint
-- A recorded payment and its allocations are never edited or deleted, by
-- anyone. A mistake is corrected by a new entry, not by rewriting an old one.
CREATE FUNCTION reject_change_append_only() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'check_violation';
END
$$;
--> statement-breakpoint
CREATE TRIGGER payments_append_only
  BEFORE UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION reject_change_append_only();
--> statement-breakpoint
CREATE TRIGGER payment_allocations_append_only
  BEFORE UPDATE OR DELETE ON payment_allocations
  FOR EACH ROW EXECUTE FUNCTION reject_change_append_only();
--> statement-breakpoint
-- The only writer of installments.paid_halalas. SECURITY DEFINER because the
-- app role holds no UPDATE on installments; it does exactly one thing with
-- the row it was handed. The check paid_halalas <= amount_halalas then
-- refuses an allocation larger than what the installment still owes.
CREATE FUNCTION payment_allocations_apply() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $$
BEGIN
  UPDATE installments
  SET paid_halalas = paid_halalas + NEW.amount_halalas
  WHERE id = NEW.installment_id AND contract_id = NEW.contract_id AND company_id = NEW.company_id;
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE TRIGGER payment_allocations_apply
  AFTER INSERT ON payment_allocations
  FOR EACH ROW EXECUTE FUNCTION payment_allocations_apply();
--> statement-breakpoint
-- At commit, every payment touched in the transaction is allocated in full:
-- no money recorded and left nowhere, and none allocated beyond what came in.
CREATE FUNCTION payments_check_fully_allocated() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $$
DECLARE
  target uuid := CASE WHEN TG_TABLE_NAME = 'payments' THEN NEW.id ELSE NEW.payment_id END;
  expected bigint;
  allocated bigint;
BEGIN
  SELECT p.amount_halalas INTO expected FROM payments p WHERE p.id = target;
  SELECT coalesce(sum(a.amount_halalas), 0) INTO allocated FROM payment_allocations a WHERE a.payment_id = target;
  IF allocated IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'payment % allocates % of %', target, allocated, expected USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER payments_fully_allocated
  AFTER INSERT ON payments
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION payments_check_fully_allocated();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER payment_allocations_fully_allocated
  AFTER INSERT ON payment_allocations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION payments_check_fully_allocated();
--> statement-breakpoint

-- ─── Expiry ───────────────────────────────────────────────────────────────
-- Ends every reservation whose 72 hours are up and frees its unit. A sweep
-- belongs to no company, so it runs as the owner (SECURITY DEFINER); it takes
-- no input and returns a count, so it cannot be steered at anything.
-- SKIP LOCKED: a unit someone is working on right now is left for the next
-- sweep (or for that transaction, which checks the clock itself).
CREATE FUNCTION expire_due_reservations() RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $$
DECLARE
  freed integer;
BEGIN
  WITH due_units AS (
    SELECT u.id
    FROM units u
    WHERE u.id IN (SELECT r.unit_id FROM reservations r WHERE r.status = 'active' AND r.expires_at <= now())
    FOR UPDATE OF u SKIP LOCKED
  ), ended AS (
    UPDATE reservations r
    SET status = 'expired', ended_at = now()
    FROM due_units d
    WHERE r.unit_id = d.id AND r.status = 'active' AND r.expires_at <= now()
    RETURNING r.unit_id
  )
  UPDATE units u
  SET status = 'available'
  FROM ended e
  WHERE u.id = e.unit_id AND u.status = 'reserved';
  GET DIAGNOSTICS freed = ROW_COUNT;
  RETURN freed;
END
$$;
--> statement-breakpoint
-- The same for one unit, waiting for its lock: the reservation path calls it
-- holding that lock already, so it frees a unit whose time is up even if the
-- sweep skipped it a moment ago. Only ever ends a reservation that is due.
CREATE FUNCTION expire_unit_reservation(p_unit_id uuid) RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $$
BEGIN
  PERFORM 1 FROM units WHERE id = p_unit_id FOR UPDATE;
  UPDATE reservations
  SET status = 'expired', ended_at = now()
  WHERE unit_id = p_unit_id AND status = 'active' AND expires_at <= now();
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  UPDATE units SET status = 'available' WHERE id = p_unit_id AND status = 'reserved';
  RETURN true;
END
$$;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION expire_due_reservations(), expire_unit_reservation(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION expire_due_reservations(), expire_unit_reservation(uuid) TO aqar_app;
