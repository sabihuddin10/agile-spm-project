-- The super admin: the one account above every admin (lib/hierarchy.js),
-- bound to an email by scripts/superadmin.js. Idempotent.
--
-- Its own file: Postgres refuses to use a new enum value inside the transaction
-- that added it, and ensureSchema runs each file as its own transaction, so the
-- index that uses the value lives in 005_one_superadmin.sql.
ALTER TYPE role ADD VALUE IF NOT EXISTS 'superadmin';
