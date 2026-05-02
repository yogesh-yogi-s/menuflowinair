-- Run this in your Supabase SQL Editor.
-- Adds order pipeline columns, audit trail, profile preferences,
-- and enables Realtime for the relevant tables.

-- 1. Extend platform_orders with timing + reason
alter table public.platform_orders
  add column if not exists status_reason text,
  add column if not exists accepted_at timestamptz,
  add column if not exists ready_at timestamptz,
  add column if not exists completed_at timestamptz;

-- 2. Audit trail for status transitions
create table if not exists public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.platform_orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.order_status_events enable row level security;

drop policy if exists "ose owner select" on public.order_status_events;
create policy "ose owner select"
  on public.order_status_events for select
  using (auth.uid() = owner_id);

drop policy if exists "ose owner insert" on public.order_status_events;
create policy "ose owner insert"
  on public.order_status_events for insert
  with check (auth.uid() = owner_id);

create index if not exists ose_order_idx
  on public.order_status_events(order_id, created_at desc);

-- 3. Profile preferences (alert sounds, browser notifications, etc.)
alter table public.profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb;

-- 4. Enable Realtime publication for relevant tables.
--    (Safe to re-run; "already exists" errors are ignored per-table.)
do $$
begin
  begin
    alter publication supabase_realtime add table public.platform_orders;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.order_status_events;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.integrations;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.menu_item_availability;
  exception when duplicate_object then null; end;
end $$;

-- 5. Analytics views (RLS inherited via security_invoker)
create or replace view public.v_orders_daily
  with (security_invoker = true)
  as
select
  owner_id,
  platform,
  date_trunc('day', placed_at) as day,
  count(*)::int as orders,
  coalesce(sum(total), 0)::numeric(12,2) as revenue
from public.platform_orders
where status not in ('rejected','cancelled')
group by 1,2,3;

create or replace view public.v_top_items
  with (security_invoker = true)
  as
select
  po.owner_id,
  (item->>'name') as name,
  sum( coalesce((item->>'qty')::int, 0) )::int as qty,
  sum( coalesce((item->>'qty')::numeric, 0) * coalesce((item->>'price')::numeric, 0) )::numeric(12,2) as revenue,
  max(po.placed_at) as last_ordered_at
from public.platform_orders po,
     jsonb_array_elements(po.items) as item
where po.status not in ('rejected','cancelled')
group by 1, 2;

grant select on public.v_orders_daily to authenticated;
grant select on public.v_top_items to authenticated;