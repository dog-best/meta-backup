-- Crypto (NEW TABLES ONLY - run ONLY if you don't already have equivalents)

-- 1) User deposit wallets
create table if not exists public.crypto_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  address text not null,
  chain text not null default 'ethereum',
  created_at timestamp with time zone not null default now()
);

-- 2) Deposits detected from Alchemy/chain
create table if not exists public.crypto_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  asset text not null,
  chain text not null default 'ethereum',
  tx_hash text not null,
  amount numeric not null,
  status text not null default 'detected', -- detected|credited|failed
  created_at timestamp with time zone not null default now(),
  unique (tx_hash)
);

-- 3) Conversion jobs (crypto -> NGN)
create table if not exists public.crypto_conversions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  asset text not null,
  amount numeric not null,
  reference text not null unique,
  status text not null default 'queued', -- queued|processing|completed|failed
  ngn_amount numeric,
  created_at timestamp with time zone not null default now()
);

-- -----------------------
-- RLS
-- -----------------------
alter table public.crypto_wallets enable row level security;
alter table public.crypto_deposits enable row level security;
alter table public.crypto_conversions enable row level security;

drop policy if exists "read_own_crypto_wallet" on public.crypto_wallets;
create policy "read_own_crypto_wallet" on public.crypto_wallets
for select to authenticated
using (user_id = auth.uid());

drop policy if exists "read_own_crypto_deposits" on public.crypto_deposits;
create policy "read_own_crypto_deposits" on public.crypto_deposits
for select to authenticated
using (user_id = auth.uid());

drop policy if exists "read_own_crypto_conversions" on public.crypto_conversions;
create policy "read_own_crypto_conversions" on public.crypto_conversions
for select to authenticated
using (user_id = auth.uid());

-- Inserts/updates should be done by Edge Functions (service role).
