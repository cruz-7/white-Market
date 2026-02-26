-- Add MoMo payout fields to users table
-- Run this in Supabase → SQL Editor → New query

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS momo_number text,
ADD COLUMN IF NOT EXISTS momo_provider text;
