-- Add payment fields to orders table
-- Run this in Supabase → SQL Editor → New query

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_reference text,
ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone;
