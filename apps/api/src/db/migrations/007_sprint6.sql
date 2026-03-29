-- ============================================================
-- Migration 007 — Sprint 6: Settings & Billing
-- ============================================================

-- Index for subscription lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_restaurant
  ON subscriptions (restaurant_id, created_at DESC);

-- Index for payment/billing history
CREATE INDEX IF NOT EXISTS idx_payments_restaurant
  ON payments (restaurant_id, created_at DESC);

-- Index for monthly order revenue aggregation
CREATE INDEX IF NOT EXISTS idx_orders_monthly_revenue
  ON orders (restaurant_id, placed_at)
  WHERE status != 'cancelled';
