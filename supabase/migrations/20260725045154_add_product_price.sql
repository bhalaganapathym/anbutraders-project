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