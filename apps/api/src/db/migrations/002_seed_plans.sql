-- ============================================================
-- Seed 001 — Plans + Super Admin
-- ============================================================

-- ── Plans ─────────────────────────────────────────────────────

INSERT INTO plans (name, price_monthly, price_yearly, max_tables, max_menu_items, max_staff, features)
VALUES
  (
    'starter',
    29.00,
    290.00,
    10,
    50,
    3,
    '{
      "advanced_analytics": false,
      "custom_domain": false,
      "white_label": false,
      "priority_support": false,
      "bulk_qr_download": false,
      "api_access": false
    }'::jsonb
  ),
  (
    'pro',
    79.00,
    790.00,
    50,
    200,
    10,
    '{
      "advanced_analytics": true,
      "custom_domain": true,
      "white_label": false,
      "priority_support": true,
      "bulk_qr_download": true,
      "api_access": false
    }'::jsonb
  ),
  (
    'enterprise',
    199.00,
    1990.00,
    9999,
    9999,
    9999,
    '{
      "advanced_analytics": true,
      "custom_domain": true,
      "white_label": true,
      "priority_support": true,
      "bulk_qr_download": true,
      "api_access": true
    }'::jsonb
  )
ON CONFLICT DO NOTHING;

-- ── Super Admin User ──────────────────────────────────────────
-- Password is set via environment variable at runtime.
-- This seed inserts a placeholder; the migrate script updates the hash.

INSERT INTO users (email, password_hash, first_name, last_name, role, restaurant_id)
VALUES (
  'admin@qrsaas.com',
  '$2b$12$placeholder_replaced_by_migrate_script',
  'Super',
  'Admin',
  'super_admin',
  NULL
)
ON CONFLICT (email) DO NOTHING;
