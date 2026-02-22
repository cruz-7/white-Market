-- Wallet tables and RLS for White Market
create table if not exists public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance numeric(12,2) not null default 0.00,
  currency text not null default 'GHS',
  pending_earnings numeric(12,2) not null default 0.00,
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('credit','debit','withdrawal','refund','pending')),
  amount numeric(12,2) not null,
  description text not null,
  reference_id text,
  balance_after numeric(12,2) not null default 0.00,
  created_at timestamptz not null default now()
);

alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;

create policy if not exists "wallets_select_own"
on public.wallets
for select
using (auth.uid() = user_id);

create policy if not exists "wallets_update_own"
on public.wallets
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy if not exists "wallet_transactions_select_own"
on public.wallet_transactions
for select
using (auth.uid() = user_id);

create policy if not exists "wallet_transactions_insert_own"
on public.wallet_transactions
for insert
with check (auth.uid() = user_id);

create index if not exists wallet_transactions_user_created_idx
on public.wallet_transactions(user_id, created_at desc);
