-- Shared counters for the security rate limits (login, registration, public forms), so every API
-- instance counts against the same quota. One row per limited key and window; the application
-- upserts it atomically (src/lib/rate-limit-store.js). Idempotent.
--
--   key_hash   SHA-256 of "<namespace>\0<key>": the key is an IP address or a normalised email, so the
--              raw value is never stored. It is the primary key, which makes the upsert atomic.
--   namespace  which limit the row belongs to (for example 'auth-login-email'); informational.
--   count      attempts counted in the current window (capped at limit + 1).
--   reset_at   when the window ends, by the database clock, which is authoritative across instances.
CREATE TABLE IF NOT EXISTS rate_limits (
  key_hash  text        PRIMARY KEY,
  namespace text        NOT NULL,
  count     integer     NOT NULL CHECK (count >= 0),
  reset_at  timestamptz NOT NULL
);

-- Expired rows are deleted in the background (oldest first).
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits (reset_at);
