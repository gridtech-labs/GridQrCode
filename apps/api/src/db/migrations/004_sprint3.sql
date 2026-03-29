-- ============================================================
-- Migration 004 — Sprint 3: Tables & QR Codes
-- ============================================================

-- Add updated_at to tables and areas
ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Triggers for tables and areas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_tables'
  ) THEN
    CREATE TRIGGER set_updated_at_tables
      BEFORE UPDATE ON tables
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_areas'
  ) THEN
    CREATE TRIGGER set_updated_at_areas
      BEFORE UPDATE ON areas
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END;
$$;

-- Additional indexes for QR and session lookups
CREATE INDEX IF NOT EXISTS idx_qr_codes_table      ON qr_codes(table_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_token       ON qr_codes(token);
CREATE INDEX IF NOT EXISTS idx_qr_codes_restaurant  ON qr_codes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_areas_restaurant     ON areas(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_restaurant  ON sessions(restaurant_id, opened_at DESC);
