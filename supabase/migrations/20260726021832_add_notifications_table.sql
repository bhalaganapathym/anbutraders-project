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