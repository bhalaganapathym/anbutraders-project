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
/*
# Add inline vehicle fields to dispatches and prices to dispatch items

1. Overview
- Vehicle details (number, driver name, driver mobile) are now entered directly on each dispatch alongside the dispatch team, instead of being selected from a separate vehicles list.
- Dispatch items now carry a per-bag/unit price so a line total and grand total can be shown.

2. Modified Tables
- `dispatches` — added `vehicle_number`, `driver_name`, `driver_mobile` (text, nullable). The existing `vehicle_id` FK is kept for backward compatibility but the app now uses the inline fields.
- `dispatch_items` — added `price` (numeric, default 0) for per-bag/unit pricing.

3. Security
- No policy changes; existing anon + authenticated CRUD policies already cover the new columns.

4. Notes
- All new columns are nullable / have defaults so existing rows remain valid.
- Idempotent: uses DO $$ ... IF NOT EXISTS ... END $$ for column additions.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dispatches' AND column_name = 'vehicle_number') THEN
    ALTER TABLE dispatches ADD COLUMN vehicle_number text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dispatches' AND column_name = 'driver_name') THEN
    ALTER TABLE dispatches ADD COLUMN driver_name text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dispatches' AND column_name = 'driver_mobile') THEN
    ALTER TABLE dispatches ADD COLUMN driver_mobile text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dispatch_items' AND column_name = 'price') THEN
    ALTER TABLE dispatch_items ADD COLUMN price numeric NOT NULL DEFAULT 0;
  END IF;
END $$;
/*
# Add price column to products

1. Overview
- Adds a per-unit price to each product so a product price list can be displayed and used for dispatch pricing.

2. Modified Tables
- `products` — added `price` (numeric, default 0) representing the price per unit (bag/piece/kg etc.).

3. Security
- No policy changes; existing anon + authenticated CRUD policies already cover the new column.

4. Notes
- Idempotent: uses DO $$ ... IF NOT EXISTS ... END $$ for the column addition.
- Existing rows get the default of 0.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'price') THEN
    ALTER TABLE products ADD COLUMN price numeric NOT NULL DEFAULT 0;
  END IF;
END $$;
/*
# Add notifications table for billing-team alerts

1. Overview
- When a dispatch is completed, a notification is created for the billing team so they know an order is ready for invoicing.

2. New Tables
- `notifications`
  - `id` (uuid, primary key)
  - `type` (text) — e.g. 'billing_alert'
  - `title` (text)
  - `message` (text)
  - `dispatch_id` (uuid, nullable, FK to dispatches)
  - `order_id` (uuid, nullable, FK to orders)
  - `customer_name` (text, nullable)
  - `read` (boolean, default false)
  - `created_at` (timestamptz, default now())

3. Security
- Enable RLS on `notifications`.
- Single-tenant no-auth app: allow anon + authenticated full CRUD (data is intentionally shared).

4. Notes
- Idempotent: CREATE TABLE IF NOT EXISTS; policies dropped before create.
*/

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'billing_alert',
  title text NOT NULL,
  message text NOT NULL,
  dispatch_id uuid REFERENCES dispatches(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  customer_name text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_notifications" ON notifications;
CREATE POLICY "anon_select_notifications" ON notifications FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_notifications" ON notifications;
CREATE POLICY "anon_insert_notifications" ON notifications FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_notifications" ON notifications;
CREATE POLICY "anon_update_notifications" ON notifications FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_notifications" ON notifications;
CREATE POLICY "anon_delete_notifications" ON notifications FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications (read);
/*
# Create dispatch-photos storage bucket

1. Overview
- Creates a public storage bucket named `dispatch-photos` to store photo files uploaded directly from the dispatch detail screen.

2. Storage
- New bucket: `dispatch-photos` (public read, so the frontend can render uploaded photos via their public URL).

3. Security
- Storage policies allow anon + authenticated to upload and read, since this is a single-tenant no-auth app.

4. Notes
- Idempotent: uses IF NOT EXISTS for the bucket.
*/

INSERT INTO storage.buckets (id, name, public)
SELECT 'dispatch-photos', 'dispatch-photos', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'dispatch-photos');

DROP POLICY IF EXISTS "anon_upload_dispatch_photos" ON storage.objects;
CREATE POLICY "anon_upload_dispatch_photos" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'dispatch-photos');

DROP POLICY IF EXISTS "anon_read_dispatch_photos" ON storage.objects;
CREATE POLICY "anon_read_dispatch_photos" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'dispatch-photos');

DROP POLICY IF EXISTS "anon_delete_dispatch_photos" ON storage.objects;
CREATE POLICY "anon_delete_dispatch_photos" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'dispatch-photos');
-- Enable real-time broadcasts for all app tables so multiple devices stay in sync.
ALTER PUBLICATION supabase_realtime ADD TABLE customers, products, orders, order_items, dispatches, dispatch_items, weights, photos, notifications;
/*
# Add brand and size columns to products

1. Overview
- Adds `brand` (text) and `size` (text) columns to the products table so steel/TMT products
  can be organized by brand (Tata Steel, iSteel, Sumangala, Suryadev) and size (8mm, 10mm, 12mm, 16mm).
- This enables a brand → size dropdown picker on the New Order page where each brand+size combo
  has its own price.

2. Modified Tables
- `products` — added:
  - `brand` (text, nullable, default null) — e.g. "Tata Steel", "iSteel", "Sumangala", "Suryadev"
  - `size` (text, nullable, default null) — e.g. "8mm", "10mm", "12mm", "16mm"

3. Security
- No policy changes; existing anon + authenticated CRUD policies already cover the new columns.

4. Notes
- Idempotent: uses DO $$ ... IF NOT EXISTS ... END $$ for column additions.
- Existing rows get NULL for brand and size; they can be edited from the Products page.
- Non-steel products (cement, pipes, etc.) can leave brand/size empty.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'brand') THEN
    ALTER TABLE products ADD COLUMN brand text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'size') THEN
    ALTER TABLE products ADD COLUMN size text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_size ON products(size);
