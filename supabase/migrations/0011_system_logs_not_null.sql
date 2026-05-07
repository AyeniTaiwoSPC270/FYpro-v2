-- Tighten system_logs schema: severity and source must never be NULL.
-- The CHECK constraints already reject invalid values; NOT NULL closes the gap
-- where a caller could omit the column entirely.
ALTER TABLE system_logs ALTER COLUMN severity SET NOT NULL;
ALTER TABLE system_logs ALTER COLUMN source   SET NOT NULL;
