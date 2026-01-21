-- Fixes for missing wallet setup + reference table reads (airtime/data/products)
-- Generated: 2026-01-20

-- 1) Ensure a user's NGN wallet ledger account exists (idempotent)
create or replace function public.ensure_user_wallet_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  insert into public.ledger_accounts (owner_type, owner_id, currency, account_type, status)
  values ('user', auth.uid(), 'NGN', 'wallet', 'active')
  on conflict (owner_id, currency, account_type) do nothing;
end;
$$;

revoke all on function public.ensure_user_wallet_account() from public;
grant execute on function public.ensure_user_wallet_account() to anon, authenticated;

-- 2) Optional: create profile + wallet on signup (covers new projects missing this trigger)
-- Safe to run multiple times.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Profiles table is expected to exist and be keyed by auth.users.id
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  insert into public.ledger_accounts (owner_type, owner_id, currency, account_type, status)
  values ('user', new.id, 'NGN', 'wallet', 'active')
  on conflict (owner_id, currency, account_type) do nothing;

  return new;
exception
  when others then
    -- Don't block signup if anything fails here
    raise log 'handle_new_user error: %', sqlerrm;
    return new;
end;
$$;

-- Create trigger on auth.users if it doesn't exist
do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created'
  ) then
    create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();
  end if;
end;
$$;

-- 3) Allow reads from reference tables used by the app (providers/products/offers)
-- If these tables already have RLS + policies, these statements are harmless with IF EXISTS guards.

-- Service providers
alter table if exists public.service_providers enable row level security;
drop policy if exists service_providers_select on public.service_providers;
create policy service_providers_select
on public.service_providers
for select
to anon, authenticated
using (true);

-- Service products
alter table if exists public.service_products enable row level security;
drop policy if exists service_products_select on public.service_products;
create policy service_products_select
on public.service_products
for select
to anon, authenticated
using (active = true);

-- Service offers
alter table if exists public.service_offers enable row level security;
drop policy if exists service_offers_select on public.service_offers;
create policy service_offers_select
on public.service_offers
for select
to anon, authenticated
using (active = true);

-- Bill providers/products (if used directly)
alter table if exists public.bill_providers enable row level security;
drop policy if exists bill_providers_select on public.bill_providers;
create policy bill_providers_select
on public.bill_providers
for select
to anon, authenticated
using (active = true);

alter table if exists public.bill_products enable row level security;
drop policy if exists bill_products_select on public.bill_products;
create policy bill_products_select
on public.bill_products
for select
to anon, authenticated
using (active = true);
