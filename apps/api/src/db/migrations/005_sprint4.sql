-- ============================================================
-- Migration 005 — Sprint 4: Ordering Engine
-- ============================================================

-- Index to speed up today's order count (used for order number generation)
CREATE INDEX idx_orders_restaurant_placed 
ON orders (restaurant_id, placed_at DESC);

-- Index for diner session lookups on orders
CREATE INDEX IF NOT EXISTS idx_orders_session
  ON orders (session_id);

-- Index for order items by status (kitchen display)
CREATE INDEX IF NOT EXISTS idx_order_items_status
  ON order_items (status);

-- Ensure order_items has a created_at index for ordering
CREATE INDEX IF NOT EXISTS idx_order_items_created
  ON order_items (order_id, created_at);
