-- Migration to add Upload SO column to production table
ALTER TABLE public.production ADD COLUMN IF NOT EXISTS "Upload SO" text;
