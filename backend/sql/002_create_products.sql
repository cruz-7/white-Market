create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.users(id) on delete cascade,
  title text not null,
  description text,
  price numeric not null,
  image_url text,
  created_at timestamp with time zone default now()
);
