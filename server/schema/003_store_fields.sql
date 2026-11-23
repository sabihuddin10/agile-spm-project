-- Columns the app's in-memory store needs that 001_schema.sql lacks. Idempotent.
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS supplier text NOT NULL DEFAULT '';
