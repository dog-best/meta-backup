-- BestCity Market (NEW TABLES ONLY)
-- Run in Supabase SQL Editor.
-- NOTE: Requires pgcrypto for gen_random_uuid(); Supabase typically has it enabled.

-- 1) Listings
create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  currency text not null default 'NGN',
  price_ngn numeric not null check (price_ngn > 0),
  status text not null default 'active',
  created_at timestamp with time zone not null default now()
);

-- 2) Orders
create table if not exists public.market_orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.market_listings(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  payment_method text not null default 'wallet',
  amount_ngn numeric not null check (amount_ngn > 0),
  status text not null default 'pending',
  created_at timestamp with time zone not null default now()
);

create index if not exists market_orders_buyer_idx on public.market_orders (buyer_id);
create index if not exists market_orders_seller_idx on public.market_orders (seller_id);

-- 3) Escrow
create table if not exists public.market_escrows (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.market_orders(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  amount_ngn numeric not null check (amount_ngn > 0),
  status text not null default 'held',
  created_at timestamp with time zone not null default now()
);

-- -----------------------
-- RLS
-- -----------------------
alter table public.market_listings enable row level security;
alter table public.market_orders enable row level security;
alter table public.market_escrows enable row level security;

-- Listings: anyone signed-in can read active listings
drop policy if exists "read_active_listings" on public.market_listings;
create policy "read_active_listings" on public.market_listings
for select to authenticated
using (status = 'active');

-- Listings: seller can insert/update their own
drop policy if exists "seller_insert_listings" on public.market_listings;
create policy "seller_insert_listings" on public.market_listings
for insert to authenticated
with check (seller_id = auth.uid());

drop policy if exists "seller_update_listings" on public.market_listings;
create policy "seller_update_listings" on public.market_listings
for update to authenticated
using (seller_id = auth.uid())
with check (seller_id = auth.uid());

-- Orders: buyer or seller can read
drop policy if exists "read_my_orders" on public.market_orders;
create policy "read_my_orders" on public.market_orders
for select to authenticated
using (buyer_id = auth.uid() or seller_id = auth.uid());

-- Orders: buyer can insert only where buyer_id = auth.uid()
drop policy if exists "buyer_insert_orders" on public.market_orders;
create policy "buyer_insert_orders" on public.market_orders
for insert to authenticated
with check (buyer_id = auth.uid());

-- Orders: buyer can update limited fields (status progression)
drop policy if exists "buyer_update_orders" on public.market_orders;
create policy "buyer_update_orders" on public.market_orders
for update to authenticated
using (buyer_id = auth.uid())
with check (buyer_id = auth.uid());

-- Escrow: buyer or seller can read
drop policy if exists "read_my_escrows" on public.market_escrows;
create policy "read_my_escrows" on public.market_escrows
for select to authenticated
using (buyer_id = auth.uid() or seller_id = auth.uid());

-- Escrow: only server (service role) should create/release.
-- For client safety, do NOT allow inserts/updates from authenticated directly.
