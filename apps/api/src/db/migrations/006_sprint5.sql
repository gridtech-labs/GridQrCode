-- ============================================================
-- Migration 006 — Sprint 5: Kitchen Display
-- ============================================================

-- Index for the KDS active orders query (status IN list + placed_at sort)
CREATE INDEX IF NOT EXISTS idx_orders_kitchen_active
  ON orders (restaurant_id, placed_at ASC)
  WHERE status IN ('pending', 'confirmed', 'preparing', 'ready');

-- Index to quickly find items for a specific order by status
CREATE INDEX IF NOT EXISTS idx_order_items_order_status
  ON order_items (order_id, status);
