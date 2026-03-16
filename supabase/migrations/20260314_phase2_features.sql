-- White Market Phase 2 Features Migration
-- Adds: Categories, Reviews, Favorites, Search History, Referrals, Notifications

-- =========================
-- Categories
-- =========================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  icon text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Insert default categories for University of Ghana marketplace
insert into public.categories (name, slug, description, icon, sort_order) values
  ('Clothing & Fashion', 'clothing', 'Student fashion, uniforms, traditional wear', 'Shirt', 1),
  ('Food & Snacks', 'food', 'Homemade food, snacks, beverages', 'Utensils', 2),
  ('Electronics & Gadgets', 'electronics', 'Phones, laptops, accessories', 'Smartphone', 3),
  ('Books & Notes', 'books', 'Textbooks, lecture notes, past questions', 'BookOpen', 4),
  ('Services', 'services', 'Tutoring, printing, delivery, repairs', 'Wrench', 5),
  ('Beauty & Health', 'beauty', 'Skincare, haircare, wellness products', 'Sparkles', 6),
  ('Housing & Rooms', 'housing', 'Hostel rooms, apartments, sublets', 'Home', 7),
  ('Sports & Fitness', 'sports', 'Gym equipment, sports gear', 'Dumbbell', 8),
  ('Events & Tickets', 'events', 'Event tickets, party supplies', 'Ticket', 9),
  ('Other', 'other', 'Miscellaneous items', 'Package', 10)
on conflict (name) do nothing;

-- Add category_id to products
alter table public.products add column if not exists category_id uuid references public.categories(id);

-- =========================
-- Reviews & Ratings
-- =========================
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  reviewer_id uuid not null references public.users(id) on delete cascade,
  reviewee_id uuid not null references public.users(id) on delete cascade,
  rating int not null check (rating >= 1 and rating <= 5),
  comment text,
  is_seller_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_order_reviewer unique (order_id, reviewer_id)
);

-- Seller average rating function
create or replace function public.get_seller_rating(seller_id uuid)
returns numeric(3,2)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(avg(rating)::numeric(3,2), 0)
  from public.reviews
  where reviewee_id = seller_id
    and is_seller_review = true;
$$;

-- Seller review count function
create or replace function public.get_seller_review_count(seller_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from public.reviews
  where reviewee_id = seller_id
    and is_seller_review = true;
$$;

-- =========================
-- Favorites / Wishlist
-- =========================
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint unique_user_product_favorite unique (user_id, product_id)
);

-- =========================
-- Search History
-- =========================
create table if not exists public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  query text not null,
  created_at timestamptz not null default now()
);

-- Index for user's search history
create index if not exists search_history_user_created_idx
on public.search_history(user_id, created_at desc);

-- =========================
-- Referrals
-- =========================
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.users(id) on delete cascade,
  referred_id uuid not null references public.users(id) on delete cascade,
  referral_code text not null unique,
  reward_claimed boolean not null default false,
  reward_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint unique_referrer_referred unique (referrer_id, referred_id)
);

-- Generate unique referral code function
create or replace function public.generate_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_exists boolean;
begin
  loop
    v_code := 'WM' || upper(substring(md5(random()::text) from 1 for 8));
    select exists(select 1 from public.referrals where referral_code = v_code) into v_exists;
    if not v_exists then
      return v_code;
    end if;
  end loop;
end;
$$;

-- Get user's referral code (create if not exists)
create or replace function public.get_or_create_referral_code(user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_referral record;
begin
  -- Check if user already has a referral code
  select * into v_referral
  from public.referrals
  where referrer_id = user_id
  limit 1;

  if found then
    return v_referral.referral_code;
  end if;

  -- Create new referral code
  v_code := public.generate_referral_code();
  
  insert into public.referrals (referrer_id, referred_id, referral_code)
  values (user_id, user_id, v_code)
  on conflict do nothing;

  return v_code;
end;
$$;

-- =========================
-- Notifications
-- =========================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('order_created', 'order_paid', 'order_completed', 'message_received', 'payout_sent', 'verification_approved', 'verification_rejected', 'referral_signup', 'review_received')),
  title text not null,
  body text,
  data jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
on public.notifications(user_id, created_at desc);

-- =========================
-- RLS for new tables
-- =========================

-- Categories (public read)
alter table public.categories enable row level security;

drop policy if exists categories_select_all on public.categories;
create policy categories_select_all
on public.categories
for select
to anon, authenticated
using (is_active = true);

-- Reviews
alter table public.reviews enable row level security;

drop policy if exists reviews_select_participants on public.reviews;
create policy reviews_select_participants
on public.reviews
for select
to authenticated
using (reviewer_id = auth.uid() or reviewee_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists reviews_insert_reviewer on public.reviews;
create policy reviews_insert_reviewer
on public.reviews
for insert
to authenticated
with check (reviewer_id = auth.uid());

drop policy if exists reviews_admin_manage on public.reviews;
create policy reviews_admin_manage
on public.reviews
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- Favorites
alter table public.favorites enable row level security;

drop policy if exists favorites_select_own on public.favorites;
create policy favorites_select_own
on public.favorites
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists favorites_insert_own on public.favorites;
create policy favorites_insert_own
on public.favorites
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists favorites_delete_own on public.favorites;
create policy favorites_delete_own
on public.favorites
for delete
to authenticated
using (user_id = auth.uid());

-- Search History
alter table public.search_history enable row level security;

drop policy if exists search_history_select_own on public.search_history;
create policy search_history_select_own
on public.search_history
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists search_history_insert_own on public.search_history;
create policy search_history_insert_own
on public.search_history
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists search_history_delete_own on public.search_history;
create policy search_history_delete_own
on public.search_history
for delete
to authenticated
using (user_id = auth.uid());

-- Referrals
alter table public.referrals enable row level security;

drop policy if exists referrals_select_own on public.referrals;
create policy referrals_select_own
on public.referrals
for select
to authenticated
using (referrer_id = auth.uid() or referred_id = auth.uid());

drop policy if exists referrals_insert_own on public.referrals;
create policy referrals_insert_own
on public.referrals
for insert
to authenticated
with check (referrer_id = auth.uid());

drop policy if exists referrals_public_referral_code on public.referrals;
create policy referrals_public_referral_code
on public.referrals
for select
to anon, authenticated
using (referrer_id = referred_id);

-- Notifications
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

-- =========================
-- Add indexes for performance
-- =========================
create index if not exists products_category_idx on public.products(category_id);
create index if not exists reviews_reviewee_idx on public.reviews(reviewee_id);
create index if not exists favorites_user_idx on public.favorites(user_id);
create index if not exists notifications_user_read_idx on public.notifications(user_id, is_read);
create index if not exists notifications_type_idx on public.notifications(type);

-- =========================
-- Update products to add category for existing items
-- =========================
-- Get the "Other" category ID and assign to products without category
update public.products
set category_id = (select id from public.categories where slug = 'other' limit 1)
where category_id is null;

-- Make category_id not null going forward (existing NULLs now mapped to "Other")
alter table public.products alter column category_id set default (select id from public.categories where slug = 'other' limit 1);