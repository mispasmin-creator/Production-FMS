ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "Planned7" date;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "Actual7" date;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "Planned8" date;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "Actual8" date;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "Planned9" date;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "Actual9" date;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "ChemicalStatus" text;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "AluminaPct" numeric;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "IronPct" numeric;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "SilicaPct" numeric;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "CalciumPct" numeric;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "TestedBy3" text;


-- 2. CREATE OR REPLACE THE SEQUENTIAL PLANNING TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.auto_plan_actual_production()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Step 7: Production done hote hi Lab Test 1 automatic plan ho jaye (Planned1)
  IF NEW."Planned1" IS NULL THEN
    NEW."Planned1" := current_date;
  END IF;

  -- Step 8: Lab Test 1 Complete (Actual1) -> Lab Test 2 Plan (Planned2)
  IF NEW."Actual1" IS NOT NULL AND NEW."Planned2" IS NULL THEN
    NEW."Planned2" := NEW."Actual1";
  END IF;

  -- Step 9: Lab Test 2 Complete (Actual2) -> Chemical Test Plan (Planned3)
  IF NEW."Actual2" IS NOT NULL AND NEW."Planned3" IS NULL THEN
    NEW."Planned3" := NEW."Actual2";
  END IF;
  -- Step 10a: Chemical Test Complete (Actual3) -> Check Anand Plan (Planned4)
  IF NEW."Actual3" IS NOT NULL AND NEW."Planned4" IS NULL THEN
    NEW."Planned4" := NEW."Actual3";
  END IF;

  -- Step 10b: Check Anand Complete (Actual4) -> Check Jitendra Plan (Planned5)
  IF NEW."Actual4" IS NOT NULL AND NEW."Planned5" IS NULL THEN
    NEW."Planned5" := NEW."Actual4";
  END IF;

  -- Step 10c: Check Jitendra Complete (Actual5) -> Check Devshree Plan (Planned6)
  IF NEW."Actual5" IS NOT NULL AND NEW."Planned6" IS NULL THEN
    NEW."Planned6" := NEW."Actual5";
  END IF;

  -- Step 11: Check Devshree Complete (Actual6) -> Management Approval Plan (Planned7)
  IF NEW."Actual6" IS NOT NULL AND NEW."Planned7" IS NULL THEN
    NEW."Planned7" := NEW."Actual6";
  END IF;

  -- Step 12: Management Approved (Actual7) -> Costing Plan (Planned8)
  IF NEW."Actual7" IS NOT NULL AND NEW."Planned8" IS NULL THEN
    NEW."Planned8" := NEW."Actual7";
  END IF;

  -- Step 13: Costing Complete (Actual8) -> Tally Plan (Planned9)
  IF NEW."Actual8" IS NOT NULL AND NEW."Planned9" IS NULL THEN
    NEW."Planned9" := NEW."Actual8";
  END IF;

  RETURN NEW;
END;
$function$;


-- 3. RE-CREATE THE TRIGGER ON actual_production TABLE
DROP TRIGGER IF EXISTS trg_auto_plan_actual_production ON public.actual_production;

CREATE TRIGGER trg_auto_plan_actual_production
BEFORE INSERT OR UPDATE ON public.actual_production
FOR EACH ROW
EXECUTE FUNCTION public.auto_plan_actual_production();


-- 4. BACKFILL TRIGGER STEPS FOR EXISTING DATA
-- 4. BACKFILL TRIGGER STEPS FOR EXISTING DATA
-- Shift historical actual dates to their correct sequential columns
UPDATE public.actual_production
SET 
  "Actual8" = COALESCE("Actual8", CASE WHEN "Costing Amount" IS NOT NULL THEN "Actual3" END),
  "Actual7" = COALESCE("Actual7", "Actual4"),
  "Actual6" = "Actual1", -- Move Devshree check completed date to Actual6
  "Actual5" = "Actual1", -- Complete Jitendra check (Actual5) using Devshree's date
  "Actual4" = "Actual1", -- Complete Anand check (Actual4) using Devshree's date
  "Actual2" = COALESCE("Actual2", "Actual3"),
  "Actual1" = COALESCE("Actual1", "Actual2")
WHERE "Actual1" IS NOT NULL AND "Actual6" IS NULL;

-- Sync chemical test data from jobcards to actual_production for historical entries
UPDATE public.actual_production ap
SET 
  "Actual3" = COALESCE(ap."Actual3", jc."Actual 4"),
  "ChemicalStatus" = COALESCE(ap."ChemicalStatus", jc."Status 4"),
  "AluminaPct" = COALESCE(ap."AluminaPct", jc."Alumina %"),
  "IronPct" = COALESCE(ap."IronPct", jc."Iron %"),
  "SilicaPct" = COALESCE(ap."SilicaPct", jc."Silica %"),
  "CalciumPct" = COALESCE(ap."CalciumPct", jc."Calcium %"),
  "TestedBy3" = COALESCE(ap."TestedBy3", jc."Tested By 3")
FROM public.jobcards jc
WHERE ap."Job Card No." = jc."JC-Job Card Number"
  AND jc."Actual 4" IS NOT NULL
  AND ap."Actual3" IS NULL;

-- Re-sync planning dates sequentially
UPDATE public.actual_production
SET "Planned2" = "Actual1"
WHERE "Actual1" IS NOT NULL AND "Planned2" IS NULL;

UPDATE public.actual_production
SET "Planned3" = "Actual2"
WHERE "Actual2" IS NOT NULL AND "Planned3" IS NULL;

UPDATE public.actual_production
SET "Planned4" = "Actual3"
WHERE "Actual3" IS NOT NULL AND "Planned4" IS NULL;

UPDATE public.actual_production
SET "Planned5" = "Actual4"
WHERE "Actual4" IS NOT NULL AND "Planned5" IS NULL;

UPDATE public.actual_production
SET "Planned6" = "Actual5"
WHERE "Actual5" IS NOT NULL AND "Planned6" IS NULL;

UPDATE public.actual_production
SET "Planned7" = "Actual6"
WHERE "Actual6" IS NOT NULL AND "Planned7" IS NULL;

UPDATE public.actual_production
SET "Planned8" = "Actual7"
WHERE "Actual7" IS NOT NULL AND "Planned8" IS NULL;

UPDATE public.actual_production
SET "Planned9" = "Actual8"
WHERE "Actual8" IS NOT NULL AND "Planned9" IS NULL;
