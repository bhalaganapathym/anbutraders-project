/*
# Steel & Cement Shop Management Schema

1. Overview
- Single-tenant app (no sign-in). All tables allow anon + authenticated CRUD.
- Manages customers, products, orders, dispatches, weight verification, photos, and vehicles.
- Billing/invoice module is intentionally NOT included.
- Vehicle assignment is mandatory to complete a dispatch.

2. New Tables
- `customers` — shop customers (name, phone, address).
- `products` — catalog (Steel, Cement, TMT Bars, Pipes, etc.) with category and unit.
- `orders` — a customer order holding selected products; status pending/confirmed.
- `order_items` — products + quantities linked to an order.
- `vehicles` — vehicle + driver details; assigned to a dispatch (mandatory for completion).
- `dispatches` — dispatch record generated from a confirmed order; status pending/confirmed/weighed/loaded/completed.
- `dispatch_items` — snapshot of products/quantities being dispatched.
- `weights` — actual weight records linked to a dispatch.
- `photos` — dispatch photo URLs linked to a dispatch.

3. Security
- RLS enabled on every table.
- Anon + authenticated CRUD allowed (single-tenant, intentionally shared data).

4. Notes
- `dispatches.vehicle_id` is nullable until assigned, but the UI enforces mandatory vehicle assignment before completing a dispatch.
- Dispatch items are a snapshot copied from order_items at dispatch creation, so later order edits do not alter past dispatch records.
*/

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  address text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_customers" ON customers;
CREATE POLICY "anon_select_customers" ON customers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_customers" ON customers;
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_customers" ON customers;
CREATE POLICY "anon_update_customers" ON customers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_customers" ON customers;
CREATE POLICY "anon_delete_customers" ON customers FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  unit text NOT NULL DEFAULT 'piece',
  stock_qty numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_products" ON products;
CREATE POLICY "anon_select_products" ON products FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_products" ON products;
CREATE POLICY "anon_insert_products" ON products FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_products" ON products;
CREATE POLICY "anon_update_products" ON products FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_products" ON products;
CREATE POLICY "anon_delete_products" ON products FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  delivery_address text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_orders" ON orders;
CREATE POLICY "anon_select_orders" ON orders FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_orders" ON orders;
CREATE POLICY "anon_delete_orders" ON orders FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 1
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_order_items" ON order_items;
CREATE POLICY "anon_select_order_items" ON order_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_order_items" ON order_items;
CREATE POLICY "anon_insert_order_items" ON order_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_order_items" ON order_items;
CREATE POLICY "anon_update_order_items" ON order_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_order_items" ON order_items;
CREATE POLICY "anon_delete_order_items" ON order_items FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_number text NOT NULL,
  driver_name text NOT NULL,
  driver_mobile text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_vehicles" ON vehicles;
CREATE POLICY "anon_select_vehicles" ON vehicles FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_vehicles" ON vehicles;
CREATE POLICY "anon_insert_vehicles" ON vehicles FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_vehicles" ON vehicles;
CREATE POLICY "anon_update_vehicles" ON vehicles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_vehicles" ON vehicles;
CREATE POLICY "anon_delete_vehicles" ON vehicles FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_no text NOT NULL,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  delivery_address text,
  status text NOT NULL DEFAULT 'pending',
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  loading_at timestamptz,
  completed_at timestamptz,
  dispatch_team text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_dispatches" ON dispatches;
CREATE POLICY "anon_select_dispatches" ON dispatches FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_dispatches" ON dispatches;
CREATE POLICY "anon_insert_dispatches" ON dispatches FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_dispatches" ON dispatches;
CREATE POLICY "anon_update_dispatches" ON dispatches FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_dispatches" ON dispatches;
CREATE POLICY "anon_delete_dispatches" ON dispatches FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS dispatch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id uuid NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'piece'
);

ALTER TABLE dispatch_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_dispatch_items" ON dispatch_items;
CREATE POLICY "anon_select_dispatch_items" ON dispatch_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_dispatch_items" ON dispatch_items;
CREATE POLICY "anon_insert_dispatch_items" ON dispatch_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_dispatch_items" ON dispatch_items;
CREATE POLICY "anon_update_dispatch_items" ON dispatch_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_dispatch_items" ON dispatch_items;
CREATE POLICY "anon_delete_dispatch_items" ON dispatch_items FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id uuid NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  actual_weight numeric NOT NULL,
  weighed_at timestamptz DEFAULT now(),
  notes text
);

ALTER TABLE weights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_weights" ON weights;
CREATE POLICY "anon_select_weights" ON weights FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_weights" ON weights;
CREATE POLICY "anon_insert_weights" ON weights FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_weights" ON weights;
CREATE POLICY "anon_update_weights" ON weights FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_weights" ON weights;
CREATE POLICY "anon_delete_weights" ON weights FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id uuid NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  url text NOT NULL,
  caption text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_photos" ON photos;
CREATE POLICY "anon_select_photos" ON photos FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_photos" ON photos;
CREATE POLICY "anon_insert_photos" ON photos FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_photos" ON photos;
CREATE POLICY "anon_update_photos" ON photos FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_photos" ON photos;
CREATE POLICY "anon_delete_photos" ON photos FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_order ON dispatches(order_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_items_dispatch ON dispatch_items(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_weights_dispatch ON weights(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_photos_dispatch ON photos(dispatch_id);