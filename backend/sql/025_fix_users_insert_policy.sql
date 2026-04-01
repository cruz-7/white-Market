-- Fix RLS policy to allow service role to insert users during signup
-- The service role key should bypass RLS, but we need to add an explicit policy

-- Drop existing policies
drop policy if exists users_insert_own on public.users;
drop policy if exists users_insert_service_role on public.users;

-- Recreate the policy for authenticated users (existing behavior)
create policy users_insert_own
on public.users
for insert
to authenticated
with check (auth.uid() = id);

-- Add policy for service role to insert users (for signup)
-- This allows the backend to create user profiles during signup
create policy users_insert_service_role
on public.users
for insert
to service_role
with check (true);
