# Plan: Real-world Integrations — mock for 5 platforms + UberEats sandbox stub

You picked **mocks for all 5 + a real UberEats stub** with **full features** (menu sync, orders, availability toggle). Here's what I'll build.

---

## 1. Database changes

New SQL migration `integrations_full_setup.sql`:

**Add to `integrations`:**
- `last_sync_status text` — `success | error | null`
- `last_sync_message text`
- `external_store_id text` — the platform's store ID after connect

**New table `platform_orders`:**
- `id uuid pk`, `owner_id uuid`, `integration_id uuid fk`
- `platform text`, `external_order_id text`
- `status text` — `received | preparing | ready | delivered | cancelled`
- `customer_name text`, `total numeric`, `items jsonb`
- `placed_at timestamptz`, `created_at timestamptz`
- Unique on `(integration_id, external_order_id)`

**New table `menu_item_availability`:**
- `id`, `owner_id`, `menu_item_id fk`, `integration_id fk`
- `available boolean default true`
- Unique on `(menu_item_id, integration_id)` — per-platform override

RLS on all: owner-only via `auth.uid() = owner_id`.

---

## 2. Adapter layer (`src/server/platforms/`)

**`types.ts`** — defines `PlatformAdapter`:
```ts
interface PlatformAdapter {
  connect(creds): Promise<{ access_token; store_id; expires_at? }>
  syncMenu(ctx, items): Promise<{ pushed: number; failed: number }>
  fetchOrders(ctx): Promise<PlatformOrder[]>
  setAvailability(ctx, itemId, available): Promise<void>
  verifyWebhook(headers, rawBody): boolean
}
```

**`mock.ts`** — talks to our own `/api/platforms/*` routes. Simulates latency, occasional failures, generates fake orders. Used for Zomato, Swiggy, DoorDash, Grubhub, and UberEats-when-no-creds.

**`ubereats.ts`** — real adapter shell:
- `connect`: OAuth2 client_credentials against `https://login.uber.com/oauth/v2/token`
- `syncMenu`: PUT `https://api.uber.com/v1/eats/stores/{store_id}/menus`
- `fetchOrders`: GET `https://api.uber.com/v2/eats/orders`
- `verifyWebhook`: HMAC-SHA256 with client secret
- Reads `UBER_CLIENT_ID`, `UBER_CLIENT_SECRET` from `process.env` if set; otherwise falls back to mock adapter so the UI never breaks.

**`index.ts`** — `getAdapter(platform)` returns the right one. UberEats picks real-vs-mock based on env presence.

---

## 3. Mock platform server routes (`src/routes/api/platforms/`)

These ARE the fake "Zomato/Swiggy/etc" backend:

- **`connect.ts`** POST — accepts `{ platform, apiKey }`, validates `apiKey === "demo-<platform>-key"`, returns `{ access_token, store_id: "store_<rand>" }`.
- **`menu.ts`** PUT — accepts `{ store_id, items[] }`, returns `{ pushed, failed }` with 5% random failure for realism.
- **`orders.ts`** GET — returns 3–8 fake orders generated from current menu items.
- **`availability.ts`** POST — accepts `{ store_id, item_id, available }`, returns ok.

**`src/routes/api/public/webhook.$platform.ts`** POST — public webhook receiver. Verifies HMAC signature using a per-integration `webhook_secret` stored in `integrations.config`, then inserts into `platform_orders`. Mirrors how UberEats/DoorDash actually push orders.

---

## 4. Server functions (`src/server/integrations.functions.ts`)

Called from the UI via `useServerFn`:

- `connectPlatform({ platform, credentials })` — calls adapter.connect, stores token + store_id + generated webhook_secret in `integrations.config` (encrypted via `INTEGRATIONS_ENC_KEY`), sets status `connected`.
- `syncMenuToIntegration({ integrationId })` — pulls user's menu items, calls adapter.syncMenu, writes `sync_logs`, updates `last_sync_status`/`last_synced_at`.
- `fetchOrdersForIntegration({ integrationId })` — calls adapter.fetchOrders, upserts into `platform_orders`.
- `togglePlatformAvailability({ menuItemId, integrationId, available })` — calls adapter.setAvailability, upserts `menu_item_availability`.
- `disconnectPlatform({ integrationId })` — clears tokens, deletes row.

All use `requireSupabaseAuth` middleware so RLS applies.

---

## 5. UI changes

### `src/routes/_authenticated/dashboard.integrations.tsx`
- "Add Integration" dialog → after platform pick, show **connect form**:
  - Mock platforms: API key input pre-filled with `demo-zomato-key` (etc.) + "Use demo key" button.
  - UberEats: shows whether real creds detected; if not, says "Using sandbox mock — add `UBER_CLIENT_ID`/`UBER_CLIENT_SECRET` secrets for real Uber API."
- Each connected card gets:
  - **Sync menu** button → toast with pushed/failed counts
  - **Fetch orders** button → toast with new-order count, links to Orders page
  - Last sync status badge (green/red) with timestamp + last 3 log lines (collapsible)
  - **Webhook URL** display: `https://menuflowinair.lovable.app/api/public/webhook/<platform>` + copy button + reveal-secret

### New `src/routes/_authenticated/dashboard.orders.tsx`
- Lists rows from `platform_orders`, filterable by platform/status.
- Status dropdown per row (preparing → ready → delivered).
- Sidebar nav entry added.

### Edit `src/routes/_authenticated/dashboard.menu.tsx` (or wherever menu items are listed)
- Per-item, per-platform availability toggles (a small grid of platform chips on each menu row). Calls `togglePlatformAvailability`.

---

## 6. Secrets

I'll add via the secrets tool:
- `INTEGRATIONS_ENC_KEY` (auto-generated, for at-rest token encryption in `integrations.config`)
- `UBER_CLIENT_ID` (optional, you fill in when you have sandbox creds)
- `UBER_CLIENT_SECRET` (optional)
- `UBER_WEBHOOK_SIGNING_SECRET` (optional)

Until UberEats secrets are filled in, that adapter falls back to mock — UI works end-to-end immediately.

---

## 7. Docs

`INTEGRATIONS.md` at project root:
- Demo keys table (`demo-zomato-key`, etc.)
- How to test the webhook locally with `curl` + signature
- Steps to apply for real UberEats / DoorDash sandbox credentials with links
- Where each adapter lives and how to add a new platform

---

## File changes summary

**New (15)**
- `integrations_full_setup.sql`
- `src/server/platforms/{types,mock,ubereats,index}.ts`
- `src/server/integrations.server.ts`
- `src/server/integrations.functions.ts`
- `src/routes/api/platforms/{connect,menu,orders,availability}.ts`
- `src/routes/api/public/webhook.$platform.ts`
- `src/routes/_authenticated/dashboard.orders.tsx`
- `INTEGRATIONS.md`

**Edited (5)**
- `src/routes/_authenticated/dashboard.integrations.tsx`
- `src/routes/_authenticated/dashboard.menu.tsx` (per-platform availability)
- `src/components/DashboardSidebar.tsx` (Orders nav entry)
- `src/services/integrations.ts` (route through new server fns)
- `src/integrations/supabase/database.types.ts` (new tables/columns)

---

## After implementation you'll be able to

1. Open Integrations → Add → pick Zomato → click "Use demo key" → connected ✅
2. Click **Sync menu** → toast: "Pushed 12 items to Zomato" → log row appears
3. Click **Fetch orders** → 5 fake orders show up in /dashboard/orders
4. Toggle "Available on Swiggy" off for one menu item → reflected per-platform
5. `curl` the webhook URL with a valid signature → new order appears live
6. Drop real `UBER_CLIENT_ID` into secrets → UberEats card silently switches to real Uber sandbox API, no code change

Approve to implement.