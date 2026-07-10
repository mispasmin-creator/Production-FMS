-- Migration to add Upload SO column to production table
ALTER TABLE public.production ADD COLUMN IF NOT EXISTS "Upload SO" text;

-- Per-production-run lab test fields. These let partial production batches
-- such as 6 + 4 move through Lab Test 1/2 as separate rows.
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "Status2" text;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "DateOfTest1" date;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "WCPercentage" numeric;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "TestedBy1" text;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "InitialSettingTime" text;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "FlowOfMaterial" text;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "FinalSettingTime" text;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "WhatToBeMixed" text;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "SieveAnalysis" text;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "BDAt110C" text;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "CCSAt100C" text;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "Status3" text;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "TestedBy2" text;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "DateOfTest2" date;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "BDAt1100C" text;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "CCSAt1100C" text;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "PLCAt1100C" text;

-- Dedicated tally fields so tally does not overwrite lab/check stage dates.
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "TallyActual" timestamp with time zone;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "TallyRemarks" text;

-- Alter existing columns to text to support string values like 'NA'
ALTER TABLE public.actual_production ALTER COLUMN "BDAt110C" TYPE text;
ALTER TABLE public.actual_production ALTER COLUMN "CCSAt100C" TYPE text;
ALTER TABLE public.actual_production ALTER COLUMN "BDAt1100C" TYPE text;
ALTER TABLE public.actual_production ALTER COLUMN "CCSAt1100C" TYPE text;
ALTER TABLE public.actual_production ALTER COLUMN "PLCAt1100C" TYPE text;
