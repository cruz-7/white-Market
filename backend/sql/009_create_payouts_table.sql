-- Create payouts table
-- Run this in Supabase → SQL Editor → New query

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.users(id),
  order_id uuid references public.orders(id),
  amount numeric not null,
  status text default 'pending',
  created_at timestamp with time zone default now()
);

-- Disable RLS for now
alter table public.payouts disable row level security;
