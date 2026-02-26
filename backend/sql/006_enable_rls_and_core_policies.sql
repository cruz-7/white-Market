-- Re-enable RLS after initial development phase.
alter table public.users enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

-- USERS policies
drop policy if exists users_select_own on public.users;
drop policy if exists users_insert_own on public.users;
drop policy if exists users_update_own on public.users;

create policy users_select_own
on public.users
for select
to authenticated
using (auth.uid() = id);

create policy users_insert_own
on public.users
for insert
to authenticated
with check (auth.uid() = id);

create policy users_update_own
on public.users
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- PRODUCTS policies
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
with check (seller_id = auth.uid());

create policy products_update_own
on public.products
for update
to authenticated
using (seller_id = auth.uid())
with check (seller_id = auth.uid());

create policy products_delete_own
on public.products
for delete
to authenticated
using (seller_id = auth.uid());

-- ORDERS policies
drop policy if exists orders_select_participants on public.orders;
drop policy if exists orders_insert_buyer on public.orders;

create policy orders_select_participants
on public.orders
for select
to authenticated
using (buyer_id = auth.uid() or seller_id = auth.uid());

create policy orders_insert_buyer
on public.orders
for insert
to authenticated
with check (buyer_id = auth.uid());
