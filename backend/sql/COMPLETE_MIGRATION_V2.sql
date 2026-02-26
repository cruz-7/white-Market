-- ============================================================================
-- UG HUSTLE MARKETPLACE - COMPLETE DATABASE MIGRATION
-- ============================================================================
-- Copy and paste this entire file into Supabase SQL Editor and click Run
-- This creates all tables and configurations needed for the marketplace
-- ============================================================================

-- ============================================================================
-- 001: Create users table
-- ============================================================================
create table if not exists public.users (
  id uuid primary key,
  full_name text,
  email text unique,
  role text default 'user',
  created_at timestamp default now()
);

-- ============================================================================
-- 002: Create products table
-- ============================================================================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.users(id) on delete cascade,
  title text not null,
  description text,
  price numeric not null,
  image_url text,
  created_at timestamp with time zone default now()
);

-- ============================================================================
-- 003: Disable RLS on products for testing
-- ============================================================================
alter table public.products disable row level security;

-- ============================================================================
-- 004: Create orders table
-- ============================================================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  buyer_id uuid references public.users(id),
  seller_id uuid references public.users(id),
  amount numeric not null,
  status text default 'pending',
  created_at timestamp with time zone default now()
);

-- ============================================================================
-- 005: Disable RLS on orders for testing
-- ============================================================================
alter table public.orders disable row level security;

-- ============================================================================
-- 006: Enable RLS and create security policies
-- ============================================================================
alter table public.users enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

-- USERS policies
drop policy if exists users_select_own on public.users;
drop policy if exists users_insert_own on public.users;
drop policy if exists users_update_own on public.users;

create policy users_select_own on public.users for select to authenticated using (auth.uid() = id);
create policy users_insert_own on public.users for insert to authenticated with check (auth.uid() = id);
create policy users_update_own on public.users for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- PRODUCTS policies
drop policy if exists products_select_all on public.products;
drop policy if exists products_insert_own on public.products;
drop policy if exists products_update_own on public.products;
drop policy if exists products_delete_own on public.products;

create policy products_select_all on public.products for select to anon, authenticated using (true);
create policy products_insert_own on public.products for insert to authenticated with check (seller_id = auth.uid());
create policy products_update_own on public.products for update to authenticated using (seller_id = auth.uid()) with check (seller_id = auth.uid());
create policy products_delete_own on public.products for delete to authenticated using (seller_id = auth.uid());

-- ORDERS policies
drop policy if exists orders_select_participants on public.orders;
drop policy if exists orders_insert_buyer on public.orders;

create policy orders_select_participants on public.orders for select to authenticated using (buyer_id = auth.uid() or seller_id = auth.uid());
create policy orders_insert_buyer on public.orders for insert to authenticated with check (buyer_id = auth.uid());

-- ============================================================================
-- 007: Add payment fields to orders table
-- ============================================================================
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_reference text,
ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone;

-- ============================================================================
-- 008: Add MoMo payout fields to users table
-- ============================================================================
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS momo_number text,
ADD COLUMN IF NOT EXISTS momo_provider text;

-- ============================================================================
-- 009: Create payouts table
-- ============================================================================
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.users(id),
  order_id uuid references public.orders(id),
  amount numeric not null,
  status text default 'pending',
  created_at timestamp with time zone default now()
);

alter table public.payouts disable row level security;

-- ============================================================================
-- 010: Add Paystack recipient code field to users table
-- ============================================================================
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS paystack_recipient_code text;

-- ============================================================================
-- 011: Set admin role
-- ============================================================================
-- UPDATE public.users SET role = 'admin' WHERE email = 'your-admin-email@st.ug.edu.gh';

-- ============================================================================
-- 012: Create wallets table
-- ============================================================================
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade unique,
  balance numeric default 0,
  pending_earnings numeric default 0,
  currency text default 'GHS',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  type text not null,
  amount numeric not null,
  description text,
  reference_id uuid,
  balance_after numeric not null,
  created_at timestamp with time zone default now()
);

-- Drop existing trigger if it exists (to handle re-runs)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create function to auto-create wallet on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.wallets (user_id, balance, pending_earnings, currency)
  values (new.id, 0, 0, 'GHS');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Create wallets for existing users
insert into public.wallets (user_id, balance, pending_earnings, currency)
select id, 0, 0, 'GHS'
from public.users
where not exists (select 1 from public.wallets where user_id = users.id)
on conflict (user_id) do nothing;

alter table public.wallets disable row level security;
alter table public.wallet_transactions disable row level security;

-- ============================================================================
-- MIGRATION COMPLETE!
-- ============================================================================
