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