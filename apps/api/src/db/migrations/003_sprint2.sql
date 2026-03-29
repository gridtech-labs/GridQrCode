-- ============================================================
-- Migration 003 — Sprint 2: Restaurant & Menu
-- ============================================================

-- Add updated_at to menu tables (if not already present)
ALTER TABLE menu_categories
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE modifiers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Auto-update triggers for menu tables
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_menu_categories'
  ) THEN
    CREATE TRIGGER set_updated_at_menu_categories
      BEFORE UPDATE ON menu_categories
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_menu_items'
  ) THEN
    CREATE TRIGGER set_updated_at_menu_items
      BEFORE UPDATE ON menu_items
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END;
$$;

-- Staff invitations table (Sprint 2 — staff management)
CREATE TABLE IF NOT EXISTS staff_invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  email         VARCHAR(255) NOT NULL,
  role          VARCHAR(50)  NOT NULL DEFAULT 'staff',
  token         VARCHAR(255) UNIQUE NOT NULL,
  invited_by    UUID NOT NULL REFERENCES users(id),
  accepted_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_invitations_token         ON staff_invitations(token);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_restaurant    ON staff_invitations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_staff_invitations_email         ON staff_invitations(email);

-- Add plan_id FK to restaurants if missing
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id);

-- Backfill plan_id from the subscriptions table
-- NOTE: subscriptions uses a 'status' column, not is_active
UPDATE restaurants r
SET plan_id = s.plan_id
FROM subscriptions s
WHERE s.restaurant_id = r.id
  AND s.status IN ('active', 'trialing', 'trial')
  AND r.plan_id IS NULL;
