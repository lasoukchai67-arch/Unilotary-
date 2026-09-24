-- ============================================================================
-- SOKXAY LOTTERY ENTERPRISE PLATFORM (LAO LOTTERY / ຫວຍໂຊກໄຊ)
-- 01_schemas.sql: PostgreSQL DDL for All Schemas and Relational Tables
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Schemas Definition
CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS security;
CREATE SCHEMA IF NOT EXISTS lottery;
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS audit;

-- ----------------------------------------------------------------------------
-- 1. SECURITY SCHEMA (Users & RBAC)
-- ----------------------------------------------------------------------------
CREATE TYPE security.user_role AS ENUM ('Player', 'Agent', 'Auditor', 'Admin');

CREATE TABLE IF NOT EXISTS security.users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    role security.user_role NOT NULL DEFAULT 'Player',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    referral_code VARCHAR(30) UNIQUE,
    referred_by UUID REFERENCES security.users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON security.users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_role ON security.users(role);

-- ----------------------------------------------------------------------------
-- 2. LOTTERY SCHEMA (Draw Periods, Animals & Tickets)
-- ----------------------------------------------------------------------------
CREATE TYPE lottery.period_status AS ENUM ('OPEN', 'CLOSED', 'DRAWN', 'CANCELLED');
CREATE TYPE lottery.bet_type AS ENUM ('DIGIT_1', 'DIGIT_2', 'DIGIT_3', 'DIGIT_4', 'DIGIT_5', 'DIGIT_6', 'ANIMAL');
CREATE TYPE lottery.ticket_status AS ENUM ('PENDING', 'WON', 'LOST', 'CANCELLED');

-- 40 Official Lao Animals Mapping (ນາມສັດ 40 ໂຕ)
CREATE TABLE IF NOT EXISTS lottery.animals (
    animal_id INT PRIMARY KEY,
    animal_name_lo VARCHAR(100) NOT NULL,
    animal_name_en VARCHAR(100) NOT NULL,
    base_number VARCHAR(2) NOT NULL,
    related_numbers VARCHAR(50) NOT NULL,
    icon_symbol VARCHAR(20) NOT NULL
);

-- Scheduled Draw Periods
CREATE TABLE IF NOT EXISTS lottery.draw_periods (
    period_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_code VARCHAR(30) NOT NULL UNIQUE, -- e.g., 'DRAW-20260923-01'
    draw_date DATE NOT NULL,
    draw_time TIME NOT NULL DEFAULT '20:00:00',
    status lottery.period_status NOT NULL DEFAULT 'OPEN',
    winning_number_6 VARCHAR(6) NULL,
    winning_animal_id INT NULL REFERENCES lottery.animals(animal_id),
    closed_at TIMESTAMP WITH TIME ZONE NULL,
    drawn_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_draw_periods_status_date ON lottery.draw_periods(status, draw_date);

-- Digital Tickets
CREATE TABLE IF NOT EXISTS lottery.tickets (
    ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_serial VARCHAR(64) NOT NULL UNIQUE,
    barcode VARCHAR(64) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES security.users(user_id) ON DELETE RESTRICT,
    period_id UUID NOT NULL REFERENCES lottery.draw_periods(period_id) ON DELETE RESTRICT,
    total_amount NUMERIC(15, 2) NOT NULL CHECK (total_amount > 0),
    total_won_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (total_won_amount >= 0),
    status lottery.ticket_status NOT NULL DEFAULT 'PENDING',
    payment_ref VARCHAR(100) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tickets_user ON lottery.tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_period ON lottery.tickets(period_id);
CREATE INDEX IF NOT EXISTS idx_tickets_serial ON lottery.tickets(ticket_serial);

-- Ticket Selected Items (Number Lines)
CREATE TABLE IF NOT EXISTS lottery.ticket_items (
    item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES lottery.tickets(ticket_id) ON DELETE CASCADE,
    bet_type lottery.bet_type NOT NULL,
    chosen_number VARCHAR(10) NOT NULL,
    chosen_animal_id INT NULL REFERENCES lottery.animals(animal_id),
    bet_amount NUMERIC(15, 2) NOT NULL CHECK (bet_amount > 0),
    multiplier NUMERIC(10, 2) NOT NULL CHECK (multiplier > 0),
    potential_win NUMERIC(15, 2) NOT NULL CHECK (potential_win > 0),
    actual_win NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (actual_win >= 0),
    is_win BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ticket_items_ticket ON lottery.ticket_items(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_items_number ON lottery.ticket_items(chosen_number);

-- ----------------------------------------------------------------------------
-- 3. FINANCE SCHEMA (Double-Entry General Ledger & Wallets)
-- ----------------------------------------------------------------------------
CREATE TYPE finance.entry_direction AS ENUM ('DEBIT', 'CREDIT');

CREATE TABLE IF NOT EXISTS finance.wallets (
    wallet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES security.users(user_id) ON DELETE RESTRICT,
    currency VARCHAR(3) NOT NULL DEFAULT 'LAK',
    balance NUMERIC(18, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0.00),
    is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallets_user ON finance.wallets(user_id);

CREATE TABLE IF NOT EXISTS finance.ledger_entries (
    entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_group_id UUID NOT NULL, -- Ties balancing DEBIT & CREDIT entries together
    wallet_id UUID NULL REFERENCES finance.wallets(wallet_id) ON DELETE RESTRICT,
    account_name VARCHAR(100) NOT NULL, -- e.g. 'USER_WALLET', 'LOTTERY_SALES_REV', 'PRIZE_POOL_EXPENSE'
    entry_type finance.entry_direction NOT NULL,
    amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0.00),
    currency VARCHAR(3) NOT NULL DEFAULT 'LAK',
    reference_type VARCHAR(50) NOT NULL, -- 'TICKET_PURCHASE', 'PRIZE_PAYOUT', 'BANK_DEPOSIT', 'COMMISSION'
    reference_id UUID NULL,
    narration TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ledger_group ON finance.ledger_entries(transaction_group_id);
CREATE INDEX IF NOT EXISTS idx_ledger_wallet ON finance.ledger_entries(wallet_id);
CREATE INDEX IF NOT EXISTS idx_ledger_reference ON finance.ledger_entries(reference_type, reference_id);

-- ----------------------------------------------------------------------------
-- 4. STORAGE SCHEMA (Cloud Storage Abstraction Metadata)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS storage.documents (
    doc_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id UUID NOT NULL,
    reference_type VARCHAR(50) NOT NULL, -- 'DIGITAL_TICKET_RECEIPT', 'DRAW_PROOF', 'USER_KYC'
    storage_key VARCHAR(500) NOT NULL UNIQUE,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_storage_ref ON storage.documents(reference_type, reference_id);

-- ----------------------------------------------------------------------------
-- 5. STAGING SCHEMA (Legacy Data Migration)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staging.legacy_raw_tickets (
    staging_id BIGSERIAL PRIMARY KEY,
    legacy_ticket_no VARCHAR(100),
    phone_number VARCHAR(50),
    draw_date VARCHAR(50),
    number_bought VARCHAR(20),
    amount_lak VARCHAR(50),
    status VARCHAR(50),
    raw_payload JSONB,
    migration_status VARCHAR(20) DEFAULT 'PENDING',
    error_message TEXT NULL,
    ingested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
