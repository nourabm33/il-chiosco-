-- Il Chiosco table ordering — initial schema

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS products (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,
  name          text NOT NULL,
  description   text,
  category      text NOT NULL,
  subcategory   text,
  price_cents   integer NOT NULL CHECK (price_cents >= 0),
  currency      char(3) NOT NULL DEFAULT 'EUR',
  is_available  boolean NOT NULL DEFAULT true,
  sort_order    integer NOT NULL DEFAULT 0,
  -- filled in once the POS technician provides the product mapping
  pos_product_id text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_menu_idx
  ON products (category, subcategory, sort_order)
  WHERE is_available;

CREATE TABLE IF NOT EXISTS restaurant_tables (
  table_number  integer PRIMARY KEY CHECK (table_number > 0),
  label         text,
  is_active     boolean NOT NULL DEFAULT true,
  -- filled in once the POS technician provides the table mapping
  pos_table_id  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code      text NOT NULL UNIQUE,
  table_number    integer NOT NULL REFERENCES restaurant_tables (table_number),
  status          text NOT NULL DEFAULT 'received'
                  CHECK (status IN ('received', 'in_progress', 'served', 'paid', 'cancelled')),
  notes           text,
  total_cents     integer NOT NULL CHECK (total_cents >= 0),
  currency        char(3) NOT NULL DEFAULT 'EUR',
  idempotency_key text UNIQUE,
  pos_status      text NOT NULL DEFAULT 'pending'
                  CHECK (pos_status IN ('pending', 'sent', 'failed', 'skipped')),
  pos_order_id    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- "which tables are occupied" and the admin board are the hot queries
CREATE INDEX IF NOT EXISTS orders_open_idx
  ON orders (table_number, created_at DESC)
  WHERE status IN ('received', 'in_progress', 'served');
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id       uuid REFERENCES products (id),
  name_snapshot    text NOT NULL,
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
  quantity         integer NOT NULL CHECK (quantity > 0 AND quantity <= 99),
  notes            text,
  line_total_cents integer NOT NULL CHECK (line_total_cents >= 0)
);

CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);

-- Transactional outbox: orders are queued here and pushed to the POS by a
-- background worker, so a POS outage can never fail or lose a customer order.
CREATE TABLE IF NOT EXISTS pos_outbox (
  id              bigserial PRIMARY KEY,
  order_id        uuid NOT NULL UNIQUE REFERENCES orders (id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sent', 'failed')),
  attempts        integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pos_outbox_due_idx
  ON pos_outbox (next_attempt_at)
  WHERE status = 'pending';

CREATE SEQUENCE IF NOT EXISTS order_code_seq;
