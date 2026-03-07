-- White Market canonical security/schema hardening migration.
-- Run this after legacy migrations to normalize policies and access controls.

create extension if not exists pgcrypto;

-- =========================
-- Core tables
-- =========================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  role text not null default 'user' check (role in ('user', 'seller', 'admin', 'banned')),
  avatar_url text,
  campus text,
  whatsapp text,
  momo_number text,
  momo_provider text,
  paystack_recipient_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  price numeric not null check (price > 0),
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  buyer_id uuid not null references public.users(id) on delete cascade,
  seller_id uuid not null references public.users(id) on delete cascade,
  amount numeric not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  payment_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.users(id) on delete cascade,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  amount numeric not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.wallets (
  user_id uuid primary key references public.users(id) on delete cascade,
  balance numeric(12, 2) not null default 0.00,
  pending_earnings numeric(12, 2) not null default 0.00,
  currency text not null default 'GHS',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('credit', 'debit', 'withdrawal', 'refund', 'pending')),
  amount numeric(12, 2) not null check (amount > 0),
  description text not null,
  reference_id text,
  balance_after numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  buyer_id uuid not null references public.users(id) on delete cascade,
  seller_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_buyer_seller_diff check (buyer_id <> seller_id)
);

create unique index if not exists conversations_product_buyer_seller_uidx
on public.conversations(product_id, buyer_id, seller_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  text text,
  image_url text,
  status text not null default 'sent' check (status in ('sent', 'delivered', 'read')),
  created_at timestamptz not null default now(),
  constraint messages_has_content check (coalesce(length(trim(text)), 0) > 0 or image_url is not null)
);

create index if not exists messages_conversation_created_idx
on public.messages(conversation_id, created_at desc);

create index if not exists wallet_transactions_user_created_idx
on public.wallet_transactions(user_id, created_at desc);

-- =========================
-- Auth sync + helper funcs
-- =========================
create or replace function public.sync_user_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', null),
    'user'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.users.full_name),
        updated_at = now();

  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_users_sync on auth.users;
create trigger on_auth_user_created_users_sync
after insert on auth.users
for each row execute procedure public.sync_user_from_auth();

create or replace function public.is_admin(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = _uid and u.role = 'admin'
  );
$$;

-- =========================
-- RLS hardening
-- =========================
alter table public.users enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.payouts enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Users
drop policy if exists users_select_own on public.users;
drop policy if exists users_insert_own on public.users;
drop policy if exists users_update_own on public.users;
drop policy if exists users_update_own_non_role on public.users;
drop policy if exists users_admin_manage on public.users;

create policy users_select_own
on public.users
for select
to authenticated
using (auth.uid() = id);

create policy users_insert_own
on public.users
for insert
to authenticated
with check (
  auth.uid() = id
  and role = 'user'
);

create policy users_update_own_non_role
on public.users
for update
to authenticated
using (auth.uid() = id)
with check (
  auth.uid() = id
  and role = (
    select u.role from public.users u where u.id = auth.uid()
  )
);

create policy users_admin_manage
on public.users
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- Products
drop policy if exists products_select_all on public.products;
drop policy if exists products_insert_own on public.products;
drop policy if exists products_update_own on public.products;
drop policy if exists products_delete_own on public.products;

create policy products_select_all
on public.products
for select
to anon, authenticated
using (true);

create policy products_insert_own
on public.products
for insert
to authenticated
with check (seller_id = auth.uid() or public.is_admin(auth.uid()));

create policy products_update_own
on public.products
for update
to authenticated
using (seller_id = auth.uid() or public.is_admin(auth.uid()))
with check (seller_id = auth.uid() or public.is_admin(auth.uid()));

create policy products_delete_own
on public.products
for delete
to authenticated
using (seller_id = auth.uid() or public.is_admin(auth.uid()));

-- Orders
drop policy if exists orders_select_participants on public.orders;
drop policy if exists orders_insert_buyer on public.orders;
drop policy if exists orders_update_participants on public.orders;

create policy orders_select_participants
on public.orders
for select
to authenticated
using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin(auth.uid()));

create policy orders_insert_buyer
on public.orders
for insert
to authenticated
with check (buyer_id = auth.uid() or public.is_admin(auth.uid()));

create policy orders_update_participants
on public.orders
for update
to authenticated
using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin(auth.uid()))
with check (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin(auth.uid()));

-- Payouts
drop policy if exists payouts_select_own on public.payouts;
drop policy if exists payouts_insert_own on public.payouts;
drop policy if exists payouts_admin_update on public.payouts;

create policy payouts_select_own
on public.payouts
for select
to authenticated
using (seller_id = auth.uid() or public.is_admin(auth.uid()));

create policy payouts_insert_own
on public.payouts
for insert
to authenticated
with check (seller_id = auth.uid() or public.is_admin(auth.uid()));

create policy payouts_admin_update
on public.payouts
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- Wallets
drop policy if exists wallets_select_own on public.wallets;
drop policy if exists wallets_insert_own on public.wallets;
drop policy if exists wallets_update_own on public.wallets;
drop policy if exists wallets_admin_select on public.wallets;

create policy wallets_select_own
on public.wallets
for select
to authenticated
using (auth.uid() = user_id);

create policy wallets_insert_own
on public.wallets
for insert
to authenticated
with check (auth.uid() = user_id);

create policy wallets_update_own
on public.wallets
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy wallets_admin_select
on public.wallets
for select
to authenticated
using (public.is_admin(auth.uid()));

-- Wallet transactions
drop policy if exists wallet_transactions_select_own on public.wallet_transactions;
drop policy if exists wallet_transactions_insert_own on public.wallet_transactions;
drop policy if exists wallet_transactions_admin_select on public.wallet_transactions;

create policy wallet_transactions_select_own
on public.wallet_transactions
for select
to authenticated
using (auth.uid() = user_id);

create policy wallet_transactions_insert_own
on public.wallet_transactions
for insert
to authenticated
with check (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy wallet_transactions_admin_select
on public.wallet_transactions
for select
to authenticated
using (public.is_admin(auth.uid()));

-- Conversations
drop policy if exists conversations_select_participants on public.conversations;
drop policy if exists conversations_insert_participants on public.conversations;
drop policy if exists conversations_update_participants on public.conversations;

create policy conversations_select_participants
on public.conversations
for select
to authenticated
using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin(auth.uid()));

create policy conversations_insert_participants
on public.conversations
for insert
to authenticated
with check (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin(auth.uid()));

create policy conversations_update_participants
on public.conversations
for update
to authenticated
using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin(auth.uid()))
with check (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin(auth.uid()));

-- Messages
drop policy if exists messages_select_participants on public.messages;
drop policy if exists messages_insert_participants on public.messages;
drop policy if exists messages_update_participants on public.messages;

create policy messages_select_participants
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid() or public.is_admin(auth.uid()))
  )
);

create policy messages_insert_participants
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid() or public.is_admin(auth.uid()))
  )
);

create policy messages_update_participants
on public.messages
for update
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid() or public.is_admin(auth.uid()))
  )
)
with check (
  exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (c.buyer_id = auth.uid() or c.seller_id = auth.uid() or public.is_admin(auth.uid()))
  )
);
