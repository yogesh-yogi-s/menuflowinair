
# Plan: Operations + Analytics + Public Menu

Three connected upgrades that turn the app from a viewer into a real operations tool, give the home page actual value, and make the menu shareable.

---

## Part 1 — Realtime + Order Status Pipeline

### Goal
Orders flow through a clear kitchen workflow, update live across tabs/devices, and (where supported) push status back to the source platform. New orders announce themselves so staff don't miss them.

### Status pipeline
Replace today's flat enum with a defined lifecycle:

```text
received → accepted → preparing → ready → out_for_delivery → completed
                   ↘ rejected
                                              ↘ cancelled
```

- **One-click transitions**: each row shows only the next valid action(s) as a primary button (e.g. "Accept", "Mark ready"), plus a secondary "Reject/Cancel" with a reason dialog.
- **Kanban view toggle**: same data as a 5-column board (Received / Preparing / Ready / Out / Done) — drag-or-click to advance. Table view stays as default.
- **Prep-time SLA badge**: color the row by age (green <10min, amber 10–20, red >20). Threshold per platform stored in `integrations.config.sla_minutes`, default 20.
- **Reason capture**: rejecting/cancelling opens a small dialog with preset reasons ("out of stock", "kitchen closed", "duplicate") + free text, stored in `platform_orders.status_reason`.
- **Audit trail**: every transition writes a row to a new `order_status_events` table (who, when, from, to, reason) — surfaced as an expandable row detail.

### Push status back to platforms
- New adapter method `updateOrderStatus(ctx, externalOrderId, status, reason?)` on `PlatformAdapter`.
- Mock adapter logs and returns ok. UberEats stub maps our statuses to Uber's POS state machine (`accept` / `deny` / `cancel`); falls back to mock when in demo mode.
- Service `updateOrderStatus(orderId, status, reason)` does: insert audit event → update `platform_orders` row → call adapter (best-effort, surfaced as toast if it fails, local state still moves).

### Realtime everywhere
Use Supabase Realtime (Postgres changes) — owner_id-scoped via RLS:

| Table | Subscribed in | Effect |
|---|---|---|
| `platform_orders` | Orders page, dashboard sidebar badge | Insert → toast + sound + cache invalidate; Update → silent invalidate |
| `order_status_events` | Order detail row | Live audit log |
| `integrations` | Integrations page | `last_sync_status` updates without refresh |
| `menu_item_availability` | Menu page | Per-platform chips reflect changes from other sessions |

A reusable `useRealtimeTable(table, queryKey)` hook in `src/hooks/use-realtime.tsx` wraps subscribe + invalidate cleanup.

### New-order alerts
- Browser notification (with permission prompt on first visit to Orders page).
- Short audio cue (single mp3 in `public/sounds/new-order.mp3`).
- Sidebar shows a count badge of orders in `received` status.
- A user setting on Profile page: "Order alerts" (sound on/off, browser notifications on/off), persisted in `profiles.preferences` jsonb.

### Database changes (`order_pipeline_setup.sql`)
```sql
-- New columns on platform_orders
alter table public.platform_orders
  add column if not exists status_reason text,
  add column if not exists accepted_at timestamptz,
  add column if not exists ready_at timestamptz,
  add column if not exists completed_at timestamptz;

-- Audit trail
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
-- owner select/insert policies (mirrors platform_orders)

-- Profile preferences
alter table public.profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb;

-- Enable realtime
alter publication supabase_realtime add table public.platform_orders;
alter publication supabase_realtime add table public.order_status_events;
alter publication supabase_realtime add table public.integrations;
alter publication supabase_realtime add table public.menu_item_availability;
```

---

## Part 2 — Analytics Dashboard

### Goal
Replace the placeholder home page (currently the Menu management page lives at `/dashboard/`) with a real overview, and move menu management to its own route.

### Routing change
- `src/routes/_authenticated/dashboard.index.tsx` becomes the **analytics dashboard**.
- Move existing menu-management content to `src/routes/_authenticated/dashboard.menu.tsx` and update the sidebar link.

### Dashboard widgets
Top KPI strip (last 7 days, with delta vs previous 7):
- Revenue
- Order count
- Average order value
- Rejection rate

Charts (recharts, already in shadcn):
- **Revenue by platform** — stacked bar, daily for 30d. Filter chips for platform.
- **Orders over time** — line, hourly for today / daily for 30d toggle.
- **Top 10 items** — horizontal bar by order count.
- **Sync health** — small table: each integration with its `last_sync_status`, last sync time, error count in 24h. Rows clickable → integrations page.

Time-range selector (Today / 7d / 30d / 90d) drives all widgets via a single shared `range` state.

### Data layer
All aggregations from `platform_orders` — no new tables. Two SQL views to keep client queries simple and fast:

```sql
create or replace view public.v_orders_daily as
select owner_id, platform, date_trunc('day', placed_at) as day,
       count(*) as orders, sum(total) as revenue
from public.platform_orders
where status not in ('rejected','cancelled')
group by 1,2,3;

create or replace view public.v_top_items as
select owner_id, item->>'name' as name,
       sum((item->>'qty')::int) as qty,
       sum((item->>'qty')::numeric * (item->>'price')::numeric) as revenue
from public.platform_orders, jsonb_array_elements(items) as item
where status not in ('rejected','cancelled')
group by 1,2;
```

Views inherit RLS from `platform_orders` via `security_invoker = true`.

Service helpers in new `src/services/analytics.ts`:
- `getKpis(range)`, `getRevenueByPlatform(range)`, `getOrdersTimeseries(range, bucket)`, `getTopItems(range, limit)`, `getSyncHealth()`.

Empty states: when there's no order data yet, each widget shows a friendly "Connect a platform & fetch demo orders to see this" with a button to Integrations.

---

## Part 3 — Public Menu Page

### Goal
A read-only, shareable, SEO-friendly public menu at a stable URL per restaurant. Drives the value of the Categories system.

### URL & slug
- Add `profiles.slug text unique` (auto-generated from `restaurant_name` on first save, editable on Profile page with availability check).
- Public route: `src/routes/m.$slug.tsx` → `/m/:slug`.
- Profile page shows the public URL with a copy button + "Open" link + "Download QR" (uses `qrcode` package, generates client-side PNG).

### Page layout (mobile-first since the user's preview is 400px)
- Header: restaurant name, optional avatar/logo, short tagline (`profiles.tagline` — new column).
- Sticky category nav (chips) that scrollspies to sections.
- One section per category, items with name, description, price, and "Unavailable" overlay when the master `available` flag is false. Items without a category go under "Other".
- No prices for categories the restaurant chose to hide (future — out of scope this round).
- Footer: "Powered by [App]".

### Data access
This page is unauthenticated, so it can't use the user's RLS context. Two options — going with **B** because it's simpler and safer:

**B. Server function with admin client, slug-scoped**
- New `src/server/menu.functions.ts` exporting `getPublicMenu(slug)` via `createServerFn`.
- Uses `supabaseAdmin` server-side to: look up `profiles` by slug → fetch that owner's `categories` and `menu_items` (only `available != null` rows; we always show items, just dim unavailable ones).
- Returns a flat `{ restaurant: {...}, categories: [{...items}] }` shape.
- Cached in TanStack Query with `staleTime: 60_000`.

### SSR & SEO
Per the route-architecture rules, the public route gets its own `head()`:
- `title`: `${restaurant_name} — Menu`
- `description`: tagline or "View our menu and order online"
- `og:title`, `og:description`, `og:image` (restaurant avatar if set)
- Loader uses `ensureQueryData` so HTML is fully rendered server-side.

### Database changes (`public_menu_setup.sql`)
```sql
alter table public.profiles
  add column if not exists slug text unique,
  add column if not exists tagline text;

create index if not exists profiles_slug_idx on public.profiles(slug);

-- Backfill slugs for existing profiles
update public.profiles
set slug = lower(regexp_replace(coalesce(restaurant_name, 'restaurant-' || substr(id::text,1,8)), '[^a-zA-Z0-9]+', '-', 'g'))
where slug is null;
```

---

## File map

**New**
- `src/hooks/use-realtime.tsx` — generic Supabase Realtime → React Query bridge
- `src/components/orders/OrderRow.tsx`, `OrderKanban.tsx`, `RejectDialog.tsx`, `OrderAlerts.tsx`
- `src/components/dashboard/KpiCard.tsx`, `RevenueChart.tsx`, `OrdersTimeseries.tsx`, `TopItemsChart.tsx`, `SyncHealthCard.tsx`, `RangePicker.tsx`
- `src/services/analytics.ts`, `src/services/orders.ts` (status transitions + audit)
- `src/server/menu.functions.ts` — public menu server fn
- `src/routes/m.$slug.tsx` — public menu page
- `src/routes/_authenticated/dashboard.menu.tsx` — moved menu management
- `order_pipeline_setup.sql`, `public_menu_setup.sql`
- `public/sounds/new-order.mp3` (small free asset)

**Edited**
- `src/integrations/supabase/database.types.ts` — new columns + `order_status_events` + `v_orders_daily` / `v_top_items`
- `src/server/platforms/types.ts` + `mock.ts` + `ubereats.ts` — `updateOrderStatus` adapter method
- `src/services/integrations.ts` — call adapter on status change
- `src/routes/_authenticated/dashboard.orders.tsx` — pipeline UI, kanban toggle, realtime, alerts, reject dialog
- `src/routes/_authenticated/dashboard.index.tsx` — replaced with analytics dashboard
- `src/routes/_authenticated/dashboard.profile.tsx` — slug editor, public URL + QR, alert preferences, tagline
- `src/components/DashboardSidebar.tsx` — `/dashboard` (Overview) + `/dashboard/menu` (Menu) + new-order count badge
- `src/services/menu.ts` + `src/services/profile.ts` — slug helpers
- `package.json` — add `qrcode` (and `@types/qrcode`)

---

## What you'll need to do after I implement
1. Run the two new SQL files in Supabase SQL Editor (in order):
   - `order_pipeline_setup.sql`
   - `public_menu_setup.sql`
2. On the Profile page, confirm/edit your auto-generated slug.
3. Open the Orders page and allow notifications when prompted.
4. Open Integrations → Fetch orders to populate the analytics dashboard with demo data.

---

## Out of scope (good follow-ups for a later round)
- Cron-based auto-sync every N minutes
- Real Uber/DoorDash status push (full OAuth + sandbox testing)
- Public menu ordering / cart / checkout
- Per-section visibility toggle on public menu
- Email/SMS digest of yesterday's performance
