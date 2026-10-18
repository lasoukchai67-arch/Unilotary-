-- =====================================================================
-- ຖານຂໍ້ມູນ ແອັບຂາຍຫວຍພັດທະນາ (PostgreSQL 14+)
--   * ເງິນທັງໝົດເປັນ BIGINT ຫົວໜ່ວຍ "ກີບ"
--   * wallet_transactions ເປັນ ledger ແກ້ບໍ່ໄດ້: balance = SUM(amount) ສະເໝີ
--   * ທຸລະກຳເງິນມີ idempotency_key ກັນຕັດ/ເຕີມຊ້ຳ
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- ຜູ້ໃຊ້ ----------
CREATE TYPE user_role   AS ENUM ('customer', 'agent', 'admin', 'finance', 'auditor');
CREATE TYPE kyc_status  AS ENUM ('unsubmitted', 'pending', 'verified', 'rejected');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'closed');

CREATE TABLE users (
    id                   BIGSERIAL PRIMARY KEY,
    phone                VARCHAR(20)  NOT NULL UNIQUE,
    full_name            VARCHAR(150),
    birth_date           DATE,
    id_card_no           VARCHAR(40),
    role                 user_role    NOT NULL DEFAULT 'customer',
    kyc                  kyc_status   NOT NULL DEFAULT 'unsubmitted',
    kyc_doc_path         TEXT,
    kyc_submitted_at     TIMESTAMPTZ,
    kyc_reviewed_by      BIGINT REFERENCES users(id),
    kyc_note             TEXT,
    status               user_status  NOT NULL DEFAULT 'active',
    pin_hash             TEXT,
    pin_failed           SMALLINT     NOT NULL DEFAULT 0,
    pin_locked_until     TIMESTAMPTZ,
    parent_agent_id      BIGINT REFERENCES users(id),
    commission_bp        INT NOT NULL DEFAULT 0 CHECK (commission_bp BETWEEN 0 AND 10000),
    daily_spend_cap      BIGINT CHECK (daily_spend_cap > 0),
    self_excluded_until  TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_parent ON users(parent_agent_id);
CREATE INDEX idx_users_kyc ON users(kyc) WHERE kyc = 'pending';

CREATE TABLE refresh_tokens (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id),
    token_hash  CHAR(64) NOT NULL UNIQUE,
    user_agent  TEXT,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);

-- ---------- ກະເປົາເງິນ ----------
CREATE TABLE wallets (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL UNIQUE REFERENCES users(id),
    balance     BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
    held        BIGINT NOT NULL DEFAULT 0 CHECK (held >= 0),   -- ເງິນທີ່ລໍຖ້າຖອນ (ຫັກອອກຈາກ balance ແລ້ວ)
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE wallet_tx_type AS ENUM ('deposit', 'withdraw', 'purchase', 'payout', 'refund', 'commission', 'adjust');

CREATE TABLE wallet_transactions (
    id              BIGSERIAL PRIMARY KEY,
    wallet_id       BIGINT NOT NULL REFERENCES wallets(id),
    type            wallet_tx_type NOT NULL,
    amount          BIGINT NOT NULL CHECK (amount <> 0),
    balance_after   BIGINT NOT NULL,
    ref_type        VARCHAR(30),
    ref_id          BIGINT,
    idempotency_key VARCHAR(120) UNIQUE,
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wtx_wallet_time ON wallet_transactions(wallet_id, created_at DESC);
CREATE INDEX idx_wtx_ref ON wallet_transactions(ref_type, ref_id);

-- ເຕີມເງິນຜ່ານທະນາຄານ / e-wallet
CREATE TYPE payment_status AS ENUM ('pending', 'success', 'failed', 'expired');

CREATE TABLE payments (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id),
    provider      VARCHAR(30) NOT NULL,
    amount        BIGINT NOT NULL CHECK (amount > 0),
    status        payment_status NOT NULL DEFAULT 'pending',
    provider_ref  VARCHAR(100) NOT NULL,
    qr_payload    TEXT,
    expires_at    TIMESTAMPTZ NOT NULL,
    raw_callback  JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at  TIMESTAMPTZ,
    UNIQUE (provider, provider_ref)
);
CREATE INDEX idx_payments_user ON payments(user_id, created_at DESC);

-- ຖອນເງິນ: requested → approved → paid | failed ; requested → rejected
CREATE TYPE withdrawal_status AS ENUM ('requested', 'approved', 'paid', 'rejected', 'failed');

CREATE TABLE withdrawals (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id),
    amount        BIGINT NOT NULL CHECK (amount > 0),
    bank_name     VARCHAR(60) NOT NULL,
    account_no    VARCHAR(40) NOT NULL,
    account_name  VARCHAR(150) NOT NULL,
    status        withdrawal_status NOT NULL DEFAULT 'requested',
    provider_ref  VARCHAR(100),
    reviewed_by   BIGINT REFERENCES users(id),
    note          TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_withdrawals_status ON withdrawals(status, created_at);

-- ---------- ງວດ ----------
CREATE TYPE draw_status AS ENUM ('scheduled', 'open', 'closed', 'resulted', 'cancelled');

CREATE TABLE draws (
    id                 BIGSERIAL PRIMARY KEY,
    draw_no            VARCHAR(20) NOT NULL UNIQUE,
    draw_date          DATE NOT NULL,
    sales_open_at      TIMESTAMPTZ NOT NULL,
    sales_close_at     TIMESTAMPTZ NOT NULL,
    status             draw_status NOT NULL DEFAULT 'scheduled',
    pending_result     CHAR(6) CHECK (pending_result ~ '^[0-9]{6}$'),  -- ຜົນທີ່ປ້ອນແລ້ວ ລໍຖ້າຢືນຢັນ
    result_number      CHAR(6) CHECK (result_number ~ '^[0-9]{6}$'),
    result_entered_by  BIGINT REFERENCES users(id),
    result_approved_by BIGINT REFERENCES users(id),
    resulted_at        TIMESTAMPTZ,
    created_by         BIGINT REFERENCES users(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (sales_close_at > sales_open_at),
    CHECK (result_approved_by IS NULL OR result_approved_by <> result_entered_by)
);
CREATE INDEX idx_draws_status ON draws(status);

CREATE TABLE draw_digit_rules (
    draw_id            BIGINT   NOT NULL REFERENCES draws(id),
    digits             SMALLINT NOT NULL CHECK (digits BETWEEN 2 AND 6),
    payout_rate        NUMERIC(12,2) NOT NULL CHECK (payout_rate > 0),
    min_amount         BIGINT NOT NULL DEFAULT 1000 CHECK (min_amount > 0),
    max_per_line       BIGINT NOT NULL CHECK (max_per_line > 0),
    default_number_cap BIGINT NOT NULL CHECK (default_number_cap > 0),
    PRIMARY KEY (draw_id, digits)
);

CREATE TABLE number_limits (
    draw_id       BIGINT     NOT NULL REFERENCES draws(id),
    number        VARCHAR(6) NOT NULL CHECK (number ~ '^[0-9]{2,6}$'),
    cap           BIGINT CHECK (cap >= 0),
    payout_rate   NUMERIC(12,2),
    is_closed     BOOLEAN NOT NULL DEFAULT false,
    updated_by    BIGINT REFERENCES users(id),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (draw_id, number)
);

CREATE TABLE number_sales (
    draw_id      BIGINT     NOT NULL REFERENCES draws(id),
    number       VARCHAR(6) NOT NULL,
    sold_amount  BIGINT NOT NULL DEFAULT 0 CHECK (sold_amount >= 0),
    cap          BIGINT NOT NULL,
    PRIMARY KEY (draw_id, number),
    CONSTRAINT number_sales_within_cap CHECK (sold_amount <= cap)
);

-- ---------- ບິນ ----------
CREATE TYPE ticket_status AS ENUM ('active', 'won', 'lost', 'paid', 'cancelled');

CREATE TABLE tickets (
    id               BIGSERIAL PRIMARY KEY,
    ticket_no        VARCHAR(30) NOT NULL UNIQUE,
    verify_code      VARCHAR(16) NOT NULL DEFAULT upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8)),
    draw_id          BIGINT NOT NULL REFERENCES draws(id),
    user_id          BIGINT NOT NULL REFERENCES users(id),
    sold_by_agent_id BIGINT REFERENCES users(id),
    buyer_phone      VARCHAR(20),
    channel          VARCHAR(10) NOT NULL DEFAULT 'app' CHECK (channel IN ('app', 'agent', 'pos')),
    total_amount     BIGINT NOT NULL CHECK (total_amount > 0),
    total_win        BIGINT NOT NULL DEFAULT 0,
    status           ticket_status NOT NULL DEFAULT 'active',
    idempotency_key  VARCHAR(80) NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, idempotency_key)
);
CREATE INDEX idx_tickets_user_time ON tickets(user_id, created_at DESC);
CREATE INDEX idx_tickets_draw_status ON tickets(draw_id, status);

CREATE TABLE ticket_lines (
    id           BIGSERIAL PRIMARY KEY,
    ticket_id    BIGINT     NOT NULL REFERENCES tickets(id),
    draw_id      BIGINT     NOT NULL REFERENCES draws(id),
    number       VARCHAR(6) NOT NULL CHECK (number ~ '^[0-9]{2,6}$'),
    digits       SMALLINT   NOT NULL GENERATED ALWAYS AS (length(number)) STORED,
    amount       BIGINT     NOT NULL CHECK (amount > 0),
    payout_rate  NUMERIC(12,2) NOT NULL,
    win_amount   BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_lines_ticket ON ticket_lines(ticket_id);
CREATE INDEX idx_lines_draw_number ON ticket_lines(draw_id, number);

-- ---------- ຈ່າຍລາງວັນ ແລະ ຄ່າຄອມ ----------
CREATE TYPE payout_status AS ENUM ('pending', 'paid', 'rejected');

CREATE TABLE payouts (
    id           BIGSERIAL PRIMARY KEY,
    ticket_id    BIGINT NOT NULL UNIQUE REFERENCES tickets(id),
    user_id      BIGINT NOT NULL REFERENCES users(id),
    amount       BIGINT NOT NULL CHECK (amount > 0),
    status       payout_status NOT NULL DEFAULT 'pending',
    approved_by  BIGINT REFERENCES users(id),
    paid_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payouts_status ON payouts(status);

CREATE TABLE commissions (
    id         BIGSERIAL PRIMARY KEY,
    agent_id   BIGINT NOT NULL REFERENCES users(id),
    ticket_id  BIGINT NOT NULL REFERENCES tickets(id),
    amount     BIGINT NOT NULL CHECK (amount >= 0),
    settled    BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (agent_id, ticket_id)
);

-- ---------- ແຈ້ງເຕືອນ ----------
CREATE TABLE notifications (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id),
    title      VARCHAR(150) NOT NULL,
    body       TEXT NOT NULL,
    data       JSONB,
    read_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

-- ---------- ຕັ້ງຄ່າລະບົບ ----------
CREATE TABLE settings (
    key        VARCHAR(60) PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_by BIGINT REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO settings (key, value) VALUES
    ('payout_auto_limit', '5000000'),      -- ລາງວັນບໍ່ເກີນ 5 ລ້ານກີບ ຈ່າຍອັດຕະໂນມັດ, ເກີນນັ້ນຕ້ອງອະນຸມັດ
    ('deposit_min', '10000'),
    ('deposit_max', '50000000'),
    ('withdraw_min', '50000'),
    ('withdraw_max_daily', '100000000');

-- ---------- Audit log (ຫ້າມ UPDATE/DELETE) ----------
CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    actor_id    BIGINT REFERENCES users(id),
    action      VARCHAR(60) NOT NULL,
    entity      VARCHAR(40) NOT NULL,
    entity_id   VARCHAR(40),
    before_data JSONB,
    after_data  JSONB,
    ip          INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_time ON audit_logs(created_at DESC);

CREATE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END $$;

CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION forbid_change();
CREATE TRIGGER wallet_tx_append_only BEFORE UPDATE OR DELETE ON wallet_transactions
    FOR EACH ROW EXECUTE FUNCTION forbid_change();

CREATE SEQUENCE ticket_seq;
