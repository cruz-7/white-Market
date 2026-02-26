create table if not exists public.users (
  id uuid primary key,
  full_name text,
  email text unique,
  role text default 'user',
  created_at timestamp default now()
);
