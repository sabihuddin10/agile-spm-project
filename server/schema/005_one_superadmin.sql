-- At most one account holds the super admin role: every such row has the same
-- indexed value, so a second one is a unique violation. Idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_one_superadmin ON users (role) WHERE role = 'superadmin';
