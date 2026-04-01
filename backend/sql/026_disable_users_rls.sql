-- Temporarily disable RLS on users table to test if that's the issue
-- This is a debugging step to identify the root cause

alter table public.users disable row level security;
