-- ============================================================
-- Migration 001 — Initial Schema
-- QR SaaS Restaurant Platform
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Plans & SaaS ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plans (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(50)   NOT NULL,
  price_monthly  DECIMAL(10,2) NOT NULL,
  price_yearly   DECIMAL(10,2) NOT NULL,
  max_tables     INT           NOT NULL DEFAULT 10,
  max_menu_items INT           NOT NULL DEFAULT 50,
  max_staff      INT           NOT NULL DEFAULT 3,
  features       JSONB         NOT NULL DEFAULT '{}',
  is_active      BOOLEAN                DEFAULT true,
  created_at     TIMESTAMPTZ            DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restaurants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id             UUID REFERENCES plans(id),
  name                VARCHAR(200)  NOT NULL,
  slug                VARCHAR(100)  UNIQUE NOT NULL,
  logo_url            TEXT,
  cover_url           TEXT,
  description         TEXT,
  address             JSONB,
  phone               VARCHAR(20),
  email               VARCHAR(255),
  currency            CHAR(3)       DEFAULT 'USD',
  timezone            VARCHAR(50)   DEFAULT 'UTC',
  tax_rate            DECIMAL(5,4)  DEFAULT 0.0000,
  service_charge      DECIMAL(5,4)  DEFAULT 0.0000,
  settings            JSONB         DEFAULT '{}',
  subscription_status VARCHAR(20)   DEFAULT 'trial',
  trial_ends_at       TIMESTAMPTZ,
  stripe_customer_id  VARCHAR(100),
  is_active           BOOLEAN       DEFAULT true,
  created_at          TIMESTAMPTZ   DEFAULT now(),
  updated_at          TIMESTAMPTZ   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id          UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  plan_id                UUID REFERENCES plans(id),
  stripe_subscription_id VARCHAR(100) UNIQUE,
  status                 VARCHAR(30)  NOT NULL,
  billing_cycle          VARCHAR(10)  DEFAULT 'monthly',
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN      DEFAULT false,
  created_at             TIMESTAMPTZ  DEFAULT now()
);

-- ── Users & Auth ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  first_name      VARCHAR(100),
  last_name       VARCHAR(100),
  role            VARCHAR(20)  NOT NULL DEFAULT 'staff',
  avatar_url      TEXT,
  is_active       BOOLEAN      DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  DEFAULT now(),
  updated_at      TIMESTAMPTZ  DEFAULT now(),
  CONSTRAINT valid_role CHECK (
    role IN ('super_admin','owner','manager','staff','kitchen')
  )
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL,
  expires_at  TIMESTAMPTZ  NOT NULL,
  ip_address  INET,
  user_agent  TEXT,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  DEFAULT now()
);

-- ── Restaurant Layout ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS areas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  sort_order    INT          DEFAULT 0,
  is_active     BOOLEAN      DEFAULT true
);

CREATE TABLE IF NOT EXISTS tables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  area_id       UUID REFERENCES areas(id),
  number        VARCHAR(20)  NOT NULL,
  name          VARCHAR(100),
  capacity      INT          DEFAULT 4,
  status        VARCHAR(20)  DEFAULT 'available',
  qr_code_url   TEXT,
  qr_token      VARCHAR(100) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active     BOOLEAN      DEFAULT true,
  created_at    TIMESTAMPTZ  DEFAULT now(),
  CONSTRAINT valid_table_status CHECK (
    status IN ('available','occupied','reserved','cleaning')
  )
);

-- ── Menu ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS menu_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  image_url       TEXT,
  sort_order      INT          DEFAULT 0,
  is_active       BOOLEAN      DEFAULT true,
  available_from  TIME,
  available_until TIME
);

CREATE TABLE IF NOT EXISTS menu_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id   UUID REFERENCES menu_categories(id),
  name          VARCHAR(200)  NOT NULL,
  description   TEXT,
  price         DECIMAL(10,2) NOT NULL,
  image_url     TEXT,
  tags          TEXT[]        DEFAULT '{}',
  allergens     TEXT[]        DEFAULT '{}',
  calories      INT,
  prep_time_min INT           DEFAULT 10,
  is_available  BOOLEAN       DEFAULT true,
  is_featured   BOOLEAN       DEFAULT false,
  sort_order    INT           DEFAULT 0,
  created_at    TIMESTAMPTZ   DEFAULT now(),
  updated_at    TIMESTAMPTZ   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modifiers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  is_required   BOOLEAN      DEFAULT false,
  min_select    INT          DEFAULT 0,
  max_select    INT          DEFAULT 1
);

CREATE TABLE IF NOT EXISTS modifier_options (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_id UUID REFERENCES modifiers(id) ON DELETE CASCADE,
  name        VARCHAR(100)  NOT NULL,
  price_delta DECIMAL(8,2)  DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS item_modifiers (
  item_id     UUID REFERENCES menu_items(id) ON DELETE CASCADE,
  modifier_id UUID REFERENCES modifiers(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, modifier_id)
);

-- ── Orders ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id       UUID REFERENCES tables(id),
  session_token  VARCHAR(100) UNIQUE NOT NULL,
  opened_at      TIMESTAMPTZ  DEFAULT now(),
  closed_at      TIMESTAMPTZ,
  customer_name  VARCHAR(100),
  customer_phone VARCHAR(20),
  is_active      BOOLEAN      DEFAULT true
);

CREATE TABLE IF NOT EXISTS orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  session_id     UUID REFERENCES sessions(id),
  table_id       UUID REFERENCES tables(id),
  order_number   VARCHAR(20)   NOT NULL,
  status         VARCHAR(20)   DEFAULT 'pending',
  type           VARCHAR(20)   DEFAULT 'dine_in',
  subtotal       DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_amount     DECIMAL(10,2) DEFAULT 0,
  service_charge DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount   DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes          TEXT,
  placed_at      TIMESTAMPTZ   DEFAULT now(),
  confirmed_at   TIMESTAMPTZ,
  ready_at       TIMESTAMPTZ,
  served_at      TIMESTAMPTZ,
  cancelled_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ   DEFAULT now(),
  updated_at     TIMESTAMPTZ   DEFAULT now(),
  CONSTRAINT valid_order_status CHECK (
    status IN ('pending','confirmed','preparing','ready','served','cancelled')
  )
);

CREATE TABLE IF NOT EXISTS order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID REFERENCES orders(id) ON DELETE CASCADE,
  item_id       UUID REFERENCES menu_items(id),
  item_name     VARCHAR(200)  NOT NULL,
  item_price    DECIMAL(10,2) NOT NULL,
  quantity      INT           NOT NULL DEFAULT 1,
  unit_price    DECIMAL(10,2) NOT NULL,
  total_price   DECIMAL(10,2) NOT NULL,
  modifications JSONB         DEFAULT '[]',
  notes         TEXT,
  status        VARCHAR(20)   DEFAULT 'pending',
  created_at    TIMESTAMPTZ   DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                  UUID REFERENCES orders(id),
  restaurant_id             UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  amount                    DECIMAL(10,2) NOT NULL,
  currency                  CHAR(3)       DEFAULT 'USD',
  method                    VARCHAR(30),
  status                    VARCHAR(20)   DEFAULT 'pending',
  stripe_payment_intent_id  VARCHAR(100),
  receipt_url               TEXT,
  paid_at                   TIMESTAMPTZ,
  created_at                TIMESTAMPTZ   DEFAULT now()
);

-- ── QR Codes ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS qr_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id      UUID REFERENCES tables(id),
  token         VARCHAR(100) UNIQUE NOT NULL,
  url           TEXT         NOT NULL,
  image_url     TEXT,
  scan_count    INT          DEFAULT 0,
  last_scanned  TIMESTAMPTZ,
  version       INT          DEFAULT 1,
  is_active     BOOLEAN      DEFAULT true,
  created_at    TIMESTAMPTZ  DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qr_scans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id  UUID REFERENCES qr_codes(id),
  ip_address  INET,
  user_agent  TEXT,
  scanned_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Analytics ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analytics_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  event_type    VARCHAR(50) NOT NULL,
  payload       JSONB       DEFAULT '{}',
  session_id    UUID,
  table_id      UUID,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_restaurants_slug       ON restaurants(slug);
CREATE INDEX IF NOT EXISTS idx_restaurants_active      ON restaurants(is_active);
CREATE INDEX IF NOT EXISTS idx_users_email             ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_restaurant        ON users(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user     ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash     ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_tables_qr_token         ON tables(qr_token);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant       ON tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant   ON menu_items(restaurant_id, category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available    ON menu_items(is_available);
CREATE INDEX IF NOT EXISTS idx_sessions_token          ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_table          ON sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant       ON orders(restaurant_id, placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status           ON orders(status, restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order       ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_analytics_restaurant    ON analytics_events(restaurant_id, created_at DESC);

-- ── updated_at triggers ───────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_restaurants
    BEFORE UPDATE ON restaurants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_users
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_menu_items
    BEFORE UPDATE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_orders
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
