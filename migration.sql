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
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "BDAt110C" numeric;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "CCSAt100C" numeric;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "Status3" text;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "TestedBy2" text;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "DateOfTest2" date;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "BDAt1100C" numeric;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "CCSAt1100C" numeric;
ALTER TABLE public.actual_production ADD COLUMN IF NOT EXISTS "PLCAt1100C" numeric;
