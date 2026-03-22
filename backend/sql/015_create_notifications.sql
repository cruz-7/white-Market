-- White Market - Notifications Table
-- Creates notifications table used by /notifications endpoints and system events.

create extension if not exists pgcrypto;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  -- Keep `type` flexible (no CHECK) so the app can add new notification types without DB edits.
  type text not null,
  title text not null,
  body text,
  data jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
on public.notifications(user_id, created_at desc);

create index if not exists notifications_user_read_idx
on public.notifications(user_id, is_read);

create index if not exists notifications_type_idx
on public.notifications(type);

-- RLS (optional). Backend uses the service role key and bypasses RLS, but enabling it
-- protects against accidental direct client access if someone queries Supabase directly.
alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
on public.notifications
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists notifications_insert_system on public.notifications;
create policy notifications_insert_system
on public.notifications
for insert
to authenticated
with check (
  user_id = auth.uid()
  or exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  )
);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
on public.notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own
on public.notifications
for delete
to authenticated
using (user_id = auth.uid());

