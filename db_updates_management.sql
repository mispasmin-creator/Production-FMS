-- DB updates for Management Approval in costing_response table
ALTER TABLE public.costing_response 
ADD COLUMN IF NOT EXISTS "Management Approval Status" text,
ADD COLUMN IF NOT EXISTS "Management Remarks" text,
ADD COLUMN IF NOT EXISTS "Management Approved At" timestamp with time zone;
