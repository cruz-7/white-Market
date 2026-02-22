-- RBAC foundation for White Market
-- Assumption: Supabase Auth is source of truth for authentication.

create type if not exists public.app_role as enum ('user', 'seller', 'admin');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists role public.app_role not null default 'user';

alter table public.profiles
  add column if not exists email text;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email, 'user')
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

create or replace function public.is_admin(_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = _uid and p.role = 'admin'
  );
$$;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_update_own_non_role" on public.profiles;
create policy "profiles_update_own_non_role"
on public.profiles
for update
using (auth.uid() = id)
with check (
  auth.uid() = id
  and role = (select p.role from public.profiles p where p.id = auth.uid())
);

drop policy if exists "profiles_admin_manage" on public.profiles;
create policy "profiles_admin_manage"
on public.profiles
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
