-- Run this in your Supabase SQL Editor.
-- Adds columns to integrations and creates platform_orders + menu_item_availability tables.

-- 1. Extend integrations
alter table public.integrations
  add column if not exists last_sync_status text,
  add column if not exists last_sync_message text,
  add column if not exists external_store_id text;

-- 2. platform_orders
create table if not exists public.platform_orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  integration_id uuid not null references public.integrations(id) on delete cascade,
  platform text not null,
  external_order_id text not null,
  status text not null default 'received',
  customer_name text,
  total numeric(10,2) not null default 0,
  items jsonb not null default '[]'::jsonb,
  placed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (integration_id, external_order_id)
);

alter table public.platform_orders enable row level security;

drop policy if exists "platform_orders owner select" on public.platform_orders;
create policy "platform_orders owner select"
  on public.platform_orders for select
  using (auth.uid() = owner_id);

drop policy if exists "platform_orders owner insert" on public.platform_orders;
create policy "platform_orders owner insert"
  on public.platform_orders for insert
  with check (auth.uid() = owner_id);

drop policy if exists "platform_orders owner update" on public.platform_orders;
create policy "platform_orders owner update"
  on public.platform_orders for update
  using (auth.uid() = owner_id);

drop policy if exists "platform_orders owner delete" on public.platform_orders;
create policy "platform_orders owner delete"
  on public.platform_orders for delete
  using (auth.uid() = owner_id);

create index if not exists platform_orders_owner_idx on public.platform_orders(owner_id, placed_at desc);

-- 3. menu_item_availability (per-platform override)
create table if not exists public.menu_item_availability (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  integration_id uuid not null references public.integrations(id) on delete cascade,
  available boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (menu_item_id, integration_id)
);

alter table public.menu_item_availability enable row level security;

drop policy if exists "mia owner select" on public.menu_item_availability;
create policy "mia owner select"
  on public.menu_item_availability for select
  using (auth.uid() = owner_id);

drop policy if exists "mia owner insert" on public.menu_item_availability;
create policy "mia owner insert"
  on public.menu_item_availability for insert
  with check (auth.uid() = owner_id);

drop policy if exists "mia owner update" on public.menu_item_availability;
create policy "mia owner update"
  on public.menu_item_availability for update
  using (auth.uid() = owner_id);

drop policy if exists "mia owner delete" on public.menu_item_availability;
create policy "mia owner delete"
  on public.menu_item_availability for delete
  using (auth.uid() = owner_id);