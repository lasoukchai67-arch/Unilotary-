-- ============================================================================
-- SOKXAY LOTTERY ENTERPRISE PLATFORM (LAO LOTTERY / ຫວຍໂຊກໄຊ)
-- 02_audit_triggers.sql: PostgreSQL Triggers for Immutable Audit Logging
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit.mutation_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(10) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    record_id VARCHAR(100) NOT NULL,
    old_data JSONB NULL,
    new_data JSONB NULL,
    changed_by VARCHAR(100) NOT NULL DEFAULT CURRENT_USER,
    client_ip VARCHAR(50) NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_table_record ON audit.mutation_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON audit.mutation_logs(changed_at);

-- ----------------------------------------------------------------------------
-- Audit Trigger Function capturing old_data and new_data
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit.fn_capture_mutation()
RETURNS TRIGGER AS $$
DECLARE
    v_record_id VARCHAR(100);
    v_old JSONB := NULL;
    v_new JSONB := NULL;
    v_client_ip VARCHAR(50);
BEGIN
    -- Extract Primary Key representation
    IF (TG_OP = 'DELETE') THEN
        v_old := to_jsonb(OLD);
        v_record_id := COALESCE(v_old->>'ticket_id', v_old->>'wallet_id', v_old->>'entry_id', v_old->>'user_id', 'UNKNOWN');
    ELSIF (TG_OP = 'UPDATE') THEN
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
        v_record_id := COALESCE(v_new->>'ticket_id', v_new->>'wallet_id', v_new->>'entry_id', v_new->>'user_id', 'UNKNOWN');
    ELSIF (TG_OP = 'INSERT') THEN
        v_new := to_jsonb(NEW);
        v_record_id := COALESCE(v_new->>'ticket_id', v_new->>'wallet_id', v_new->>'entry_id', v_new->>'user_id', 'UNKNOWN');
    END IF;

    -- Safely retrieve optional session context (e.g. set by API middleware)
    BEGIN
        v_client_ip := current_setting('app.client_ip', true);
    EXCEPTION WHEN OTHERS THEN
        v_client_ip := inet_client_addr()::TEXT;
    END;

    INSERT INTO audit.mutation_logs (
        table_name,
        operation,
        record_id,
        old_data,
        new_data,
        changed_by,
        client_ip,
        changed_at
    ) VALUES (
        TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
        TG_OP,
        v_record_id,
        v_old,
        v_new,
        COALESCE(current_setting('app.current_user_id', true), SESSION_USER),
        v_client_ip,
        CURRENT_TIMESTAMP
    );

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- Bind Triggers to Core Mission-Critical Tables
-- ----------------------------------------------------------------------------

-- 1. Tickets Mutation Trigger
DROP TRIGGER IF EXISTS trg_audit_tickets ON lottery.tickets;
CREATE TRIGGER trg_audit_tickets
AFTER INSERT OR UPDATE OR DELETE ON lottery.tickets
FOR EACH ROW EXECUTE FUNCTION audit.fn_capture_mutation();

-- 2. Wallets Mutation Trigger
DROP TRIGGER IF EXISTS trg_audit_wallets ON finance.wallets;
CREATE TRIGGER trg_audit_wallets
AFTER INSERT OR UPDATE OR DELETE ON finance.wallets
FOR EACH ROW EXECUTE FUNCTION audit.fn_capture_mutation();

-- 3. Financial Ledger Immutability & Audit Trigger
DROP TRIGGER IF EXISTS trg_audit_ledger ON finance.ledger_entries;
CREATE TRIGGER trg_audit_ledger
AFTER INSERT ON finance.ledger_entries
FOR EACH ROW EXECUTE FUNCTION audit.fn_capture_mutation();

-- Prevent UPDATE or DELETE on ledger_entries to enforce immutability
CREATE OR REPLACE FUNCTION finance.fn_prevent_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Financial Ledger entries are IMMUTABLE and cannot be modified or deleted. Reverse entry required.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_ledger_update ON finance.ledger_entries;
CREATE TRIGGER trg_prevent_ledger_update
BEFORE UPDATE OR DELETE ON finance.ledger_entries
FOR EACH ROW EXECUTE FUNCTION finance.fn_prevent_ledger_mutation();
