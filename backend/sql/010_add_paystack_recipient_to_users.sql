-- Add Paystack recipient code field to users table
-- Run this in Supabase → SQL Editor → New query

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS paystack_recipient_code text;
