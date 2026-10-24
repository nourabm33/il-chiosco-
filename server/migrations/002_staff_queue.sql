-- Staff-entered orders + shared release queue in front of the POS.
--
-- orders.stage is the queue lifecycle (who controls the order right now):
--   draft      yellow  — a waiter is entering / editing it
--   queued     orange  — confirmed, waiting in the shared FIFO queue
--   releasing  orange  — taken off the queue, POS delivery in progress
--   sent       green   — the POS accepted it
--   simulated          — released while POS_DRIVER=simulation; NOT sent to the till
--   failed             — POS delivery gave up; a manager can retry
--   cancelled
-- orders.status keeps the service lifecycle (received → in_progress → served → paid).

CREATE TABLE IF NOT EXISTS staff_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username      text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9._-]{3,40}$'),
  display_name  text NOT NULL,
  role          text NOT NULL CHECK (role IN ('waiter', 'manager')),
  password_hash text NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_sessions (
  token_hash   text PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES staff_users (id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS staff_sessions_user_idx ON staff_sessions (user_id);

-- Preparation rules per product. Version 1 releases one global FIFO queue and
-- does not use these yet; they exist so categories can later get their own
-- pace (e.g. water/espresso fast-tracked, cocktails at the bartender's pace).
CREATE TABLE IF NOT EXISTS prep_profiles (
  key          text PRIMARY KEY,
  label        text NOT NULL,
  prep_seconds integer NOT NULL CHECK (prep_seconds >= 0)
);
INSERT INTO prep_profiles (key, label, prep_seconds) VALUES
  ('standard', 'Bancone (standard)', 240),
  ('quick', 'Veloce (acqua, espresso)', 60),
  ('cocktail', 'Cocktail', 240)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS prep_profile text NOT NULL DEFAULT 'standard'
  REFERENCES prep_profiles (key);
UPDATE products SET prep_profile = 'cocktail' WHERE category = 'cocktail';

-- Single-row settings table; the row lock serialises every release.
CREATE TABLE IF NOT EXISTS queue_settings (
  id                    boolean PRIMARY KEY DEFAULT true CHECK (id),
  mode                  text NOT NULL DEFAULT 'normal' CHECK (mode IN ('normal', 'busy', 'pause')),
  busy_interval_seconds integer NOT NULL DEFAULT 240
                        CHECK (busy_interval_seconds BETWEEN 30 AND 1800),
  last_release_at       timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid REFERENCES staff_users (id)
);
INSERT INTO queue_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE SEQUENCE IF NOT EXISTS order_queue_seq;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'draft'
    CHECK (stage IN ('draft', 'queued', 'releasing', 'sent', 'simulated', 'failed', 'cancelled')),
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'staff'
    CHECK (source IN ('staff', 'integration', 'customer')),
  -- id of the order in an external waiter app, for de-duplicated intake
  ADD COLUMN IF NOT EXISTS external_ref text UNIQUE,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES staff_users (id),
  ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES staff_users (id),
  ADD COLUMN IF NOT EXISTS queue_seq bigint,
  ADD COLUMN IF NOT EXISTS queued_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS release_error text;

-- Orders placed before this migration came from the customer page and were
-- already handed to the outbox.
UPDATE orders
   SET source = 'customer',
       stage = CASE pos_status
                 WHEN 'sent' THEN 'sent'
                 WHEN 'failed' THEN 'failed'
                 WHEN 'pending' THEN 'releasing'
                 ELSE 'simulated'
               END,
       queued_at = created_at,
       released_at = created_at
 WHERE stage = 'draft';

CREATE INDEX IF NOT EXISTS orders_queue_idx ON orders (queue_seq) WHERE stage = 'queued';
CREATE INDEX IF NOT EXISTS orders_stage_table_idx ON orders (table_number, stage);

-- Audit trail of every stage / status change.
CREATE TABLE IF NOT EXISTS order_events (
  id         bigserial PRIMARY KEY,
  order_id   uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  kind       text NOT NULL,
  from_value text,
  to_value   text,
  actor_id   uuid REFERENCES staff_users (id),
  detail     text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_events_order_idx ON order_events (order_id, created_at);
