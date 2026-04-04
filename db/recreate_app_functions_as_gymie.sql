-- Run this file as a DB owner/superuser (for example: postgres).
-- Purpose: drop legacy app functions owned by another role and recreate them as gymie.
--
-- Example:
--   psql -h <host> -p <port> -U postgres -d gymie -f db/recreate_app_functions_as_gymie.sql

BEGIN;

-- Ensure we are not in a failed transaction state before this file runs.
-- If your SQL console already shows 25P02, execute ROLLBACK first.

DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.is_valid_training_days(integer[]) CASCADE;

SET ROLE gymie;

CREATE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $fn$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

CREATE FUNCTION public.is_valid_training_days(days INT[])
RETURNS BOOLEAN AS $fn$
DECLARE
  day_count INT;
  distinct_count INT;
BEGIN
  IF days IS NULL THEN
    RETURN FALSE;
  END IF;

  day_count := cardinality(days);
  IF day_count < 2 OR day_count > 7 THEN
    RETURN FALSE;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(days) AS d
    WHERE d < 0 OR d > 6
  ) THEN
    RETURN FALSE;
  END IF;

  SELECT COUNT(DISTINCT d)
  INTO distinct_count
  FROM unnest(days) AS d;

  IF distinct_count <> day_count THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$fn$ LANGUAGE plpgsql IMMUTABLE;

RESET ROLE;

COMMIT;
