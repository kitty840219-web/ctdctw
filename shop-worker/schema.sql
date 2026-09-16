-- CTDC 周邊商品商店 — D1 資料庫結構
-- 套用方式見 shop-worker/README.md

CREATE TABLE IF NOT EXISTS admin_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('super_admin','manager','staff')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token          TEXT PRIMARY KEY,
  admin_user_id  INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at     TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(admin_user_id);

CREATE TABLE IF NOT EXISTS products (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT '',
  description  TEXT NOT NULL DEFAULT '',
  image_url    TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_variants (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku           TEXT NOT NULL UNIQUE,
  option_label  TEXT NOT NULL DEFAULT '',
  price         INTEGER NOT NULL,
  stock_qty     INTEGER NOT NULL DEFAULT 0,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

CREATE TABLE IF NOT EXISTS orders (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no           TEXT NOT NULL UNIQUE,
  status             TEXT NOT NULL DEFAULT 'pending_payment'
                      CHECK (status IN ('pending_payment','paid','processing','shipped','completed','cancelled','payment_failed')),
  customer_name      TEXT NOT NULL,
  customer_phone     TEXT NOT NULL,
  customer_email     TEXT NOT NULL,
  shipping_address   TEXT NOT NULL,
  note               TEXT NOT NULL DEFAULT '',
  subtotal           INTEGER NOT NULL,
  payment_gateway    TEXT NOT NULL DEFAULT 'ecpay',
  payment_trade_no   TEXT,
  tracking_no        TEXT,
  paid_at            TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id          INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id        INTEGER NOT NULL REFERENCES product_variants(id),
  product_name      TEXT NOT NULL,
  option_label      TEXT NOT NULL DEFAULT '',
  unit_price        INTEGER NOT NULL,
  qty               INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
