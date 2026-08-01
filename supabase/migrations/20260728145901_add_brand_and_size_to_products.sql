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
