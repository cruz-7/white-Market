-- White Market - Additional Features Migration
-- Adds: Order Disputes, Product Views, Password Reset

-- =========================
-- Order Disputes
-- =========================
create table if not exists public.order_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  raised_by uuid not null references public.users(id),
  reason text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'closed')),
  resolution text,
  resolved_by uuid references public.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- RLS for order disputes
alter table public.order_disputes enable row level security;

drop policy if exists order_disputes_select_participants on public.order_disputes;
create policy order_disputes_select_participants
on public.order_disputes
for select
to authenticated
using (
  exists (select 1 from public.orders where id = order_disputes.order_id and buyer_id = auth.uid())
  or exists (select 1 from public.orders where id = order_disputes.order_id and seller_id = auth.uid())
  or exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

drop policy if exists order_disputes_insert_participant on public.order_disputes;
create policy order_disputes_insert_participant
on public.order_disputes
for insert
to authenticated
with check (
  exists (select 1 from public.orders where id = order_disputes.order_id and buyer_id = auth.uid())
  or exists (select 1 from public.orders where id = order_disputes.order_id and seller_id = auth.uid())
);

drop policy if exists order_disputes_admin_manage on public.order_disputes;
create policy order_disputes_admin_manage
on public.order_disputes
for all
to authenticated
using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

-- Index for order disputes
create index if not exists order_disputes_order_idx on public.order_disputes(order_id);

-- =========================
-- Add completed_at to orders
-- =========================
alter table public.orders add column if not exists completed_at timestamptz;

-- =========================
-- Add is_active to products (soft delete)
-- =========================
alter table public.products add column if not exists is_active boolean default true;

-- =========================
-- Add view_count to products
-- =========================
alter table public.products add column if not exists view_count integer default 0;

-- Index for view count
create index if not exists products_view_count_idx on public.products(view_count desc);

-- =========================
-- Add completed_at to order disputes resolution
-- =========================
