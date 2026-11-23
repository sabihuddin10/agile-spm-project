-- Time-clock invariants enforced by the API are also protected in PostgreSQL,
-- including writes made by maintenance scripts or future services.
--
-- This file runs every time the schema is applied (every API instance start), so the expensive parts must run
-- only when there is something to do: the exclusive table lock, re-validating every row against the
-- constraints and building the unique indexes. When the constraints are already validated and the indexes
-- already exist, the block below does nothing. Otherwise the whole migration runs under one lock, serialising
-- it across serverless instances; the lock is released when the schema file's query transaction commits.
DO $mig$
BEGIN
  IF EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'ck_attendance_sessions_clock_order'
         AND conrelid = 'attendance_sessions'::regclass AND convalidated)
     AND EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'ck_attendance_breaks_time_order'
         AND conrelid = 'attendance_breaks'::regclass AND convalidated)
     AND EXISTS (
       SELECT 1 FROM pg_indexes
       WHERE schemaname = current_schema() AND indexname = 'uq_attendance_sessions_one_open')
     AND EXISTS (
       SELECT 1 FROM pg_indexes
       WHERE schemaname = current_schema() AND indexname = 'uq_attendance_breaks_one_open')
  THEN
    -- Already migrated. Only tidy up the old plain index a previous version of 001 kept re-creating
    -- (a no-op once it is gone, and it takes no lock when absent).
    DROP INDEX IF EXISTS idx_attendance_sessions_open;
    RETURN;
  END IF;

  LOCK TABLE attendance_sessions, attendance_breaks IN ACCESS EXCLUSIVE MODE;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_attendance_sessions_clock_order'
      AND conrelid = 'attendance_sessions'::regclass
  ) THEN
    ALTER TABLE attendance_sessions
      ADD CONSTRAINT ck_attendance_sessions_clock_order
      CHECK (clock_out IS NULL OR clock_out > clock_in) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_attendance_breaks_time_order'
      AND conrelid = 'attendance_breaks'::regclass
  ) THEN
    ALTER TABLE attendance_breaks
      ADD CONSTRAINT ck_attendance_breaks_time_order
      CHECK ("end" IS NULL OR "end" > "start") NOT VALID;
  END IF;

  ALTER TABLE attendance_sessions
    VALIDATE CONSTRAINT ck_attendance_sessions_clock_order;
  ALTER TABLE attendance_breaks
    VALIDATE CONSTRAINT ck_attendance_breaks_time_order;

  -- This index also serves the open-session lookup used by the workforce view.
  DROP INDEX IF EXISTS idx_attendance_sessions_open;
  CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_sessions_one_open
    ON attendance_sessions (user_id)
    WHERE clock_out IS NULL;

  CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_breaks_one_open
    ON attendance_breaks (session_id)
    WHERE "end" IS NULL;
END;
$mig$;
