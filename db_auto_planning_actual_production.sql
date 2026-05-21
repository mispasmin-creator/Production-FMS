-- Auto-planning for the main actual_production workflow.
-- Run this in Supabase SQL Editor after reviewing the backfill section.

CREATE OR REPLACE FUNCTION public.auto_plan_actual_production()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- New production logs should enter the Devshree / Production Incharge tab.
  IF NEW."Planned1" IS NULL THEN
    NEW."Planned1" := current_date;
  END IF;

  -- Devshree complete -> Tally / next verification.
  IF NEW."Actual1" IS NOT NULL AND NEW."Planned2" IS NULL THEN
    NEW."Planned2" := NEW."Actual1";
  END IF;

  -- Tally complete -> Costing.
  IF NEW."Actual2" IS NOT NULL AND NEW."Planned3" IS NULL THEN
    NEW."Planned3" := NEW."Actual2";
  END IF;

  -- Costing complete -> Management.
  IF NEW."Actual3" IS NOT NULL AND NEW."Planned4" IS NULL THEN
    NEW."Planned4" := NEW."Actual3";
  END IF;

  -- Management complete -> ANAND / Supervisor.
  IF NEW."Actual4" IS NOT NULL AND NEW."Planned5" IS NULL THEN
    NEW."Planned5" := NEW."Actual4";
  END IF;

  -- ANAND / Supervisor complete -> Jitendra.
  IF NEW."Actual5" IS NOT NULL AND NEW."Planned6" IS NULL THEN
    NEW."Planned6" := NEW."Actual5";
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_plan_actual_production ON public.actual_production;

CREATE TRIGGER trg_auto_plan_actual_production
BEFORE INSERT OR UPDATE ON public.actual_production
FOR EACH ROW
EXECUTE FUNCTION public.auto_plan_actual_production();

-- Backfill existing rows so old production logs enter the same workflow.
-- If you do not want every existing production row to appear for Devshree,
-- skip the first UPDATE and only run the stage-completion backfills below it.

UPDATE public.actual_production
SET "Planned1" = current_date
WHERE "Job Card No." IS NOT NULL
  AND trim("Job Card No.") <> ''
  AND "Planned1" IS NULL;

UPDATE public.actual_production
SET "Planned2" = "Actual1"
WHERE "Actual1" IS NOT NULL
  AND "Planned2" IS NULL;

UPDATE public.actual_production
SET "Planned3" = "Actual2"
WHERE "Actual2" IS NOT NULL
  AND "Planned3" IS NULL;

UPDATE public.actual_production
SET "Planned4" = "Actual3"
WHERE "Actual3" IS NOT NULL
  AND "Planned4" IS NULL;

UPDATE public.actual_production
SET "Planned5" = "Actual4"
WHERE "Actual4" IS NOT NULL
  AND "Planned5" IS NULL;

UPDATE public.actual_production
SET "Planned6" = "Actual5"
WHERE "Actual5" IS NOT NULL
  AND "Planned6" IS NULL;
