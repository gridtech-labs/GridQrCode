-- ============================================================
-- Migration 008 — Sprint 7/8: Polish & Launch
-- ============================================================

-- Full-text search index on menu items (name + description)
CREATE INDEX IF NOT EXISTS idx_menu_items_search
  ON menu_items USING gin(
    to_tsvector('english', name || ' ' || COALESCE(description, ''))
  );

-- Composite index for fast diner menu loading (restaurant + available)
CREATE INDEX IF NOT EXISTS idx_menu_items_diner
  ON menu_items (restaurant_id, is_available, sort_order);

-- Index for analytics: orders grouped by date range
CREATE INDEX IF NOT EXISTS idx_orders_analytics
  ON orders (restaurant_id, placed_at)
  WHERE status != 'cancelled';

-- Index for QR scan analytics
CREATE INDEX IF NOT EXISTS idx_qr_scans_date
  ON qr_scans (qr_code_id, scanned_at DESC);

-- Partial index: only pending/confirmed orders (for order queue)
CREATE INDEX IF NOT EXISTS idx_orders_active_queue
  ON orders (restaurant_id, placed_at ASC)
  WHERE status IN ('pending', 'confirmed', 'preparing');

-- Ensure refresh tokens are cleaned up efficiently
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expiry
  ON refresh_tokens (expires_at)
  WHERE revoked_at IS NULL;
