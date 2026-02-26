create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  buyer_id uuid references public.users(id),
  seller_id uuid references public.users(id),
  amount numeric not null,
  status text default 'pending',
  created_at timestamp with time zone default now()
);
