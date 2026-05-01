## Goals

1. Let users enter **real platform credentials** (per-platform, with the field names each platform actually uses on its developer portal). If left blank, fall back to the existing mock flow.
2. Fix the admin tables error: `menu_item_availability.created_at does not exist`.
3. Fix the empty **Categories** table in admin and explain what it's for.

---

## 1. Real-credential forms per platform

Today only UberEats has a real-credential block. The connect dialog only collects an `apiKey` for the others. I'll define a per-platform credential schema using the **exact field labels each platform uses on its real developer portal**, then render a dynamic form in `dashboard.integrations.tsx`.

**Field schema (`src/server/platforms/credentials.ts`, new):**

| Platform | Real fields (portal labels) | Where users get them |
|---|---|---|
| UberEats | `Client ID`, `Client Secret`, `Store UUID` | developer.uber.com → Eats app |
| DoorDash | `Developer ID`, `Key ID`, `Signing Secret`, `Store ID` | developer.doordash.com → Drive/Marketplace app |
| Grubhub | `Client ID`, `Client Secret`, `Restaurant ID` | Grubhub for Restaurants → API access |
| Zomato | `API Key`, `Restaurant ID` | partners.zomato.com (legacy partner API) |
| Swiggy | `Partner API Key`, `Restaurant ID` | partner.swiggy.com → Integrations |

Each field has: `name`, `label`, `type` (`text` | `password`), `placeholder`, `required`, `helpUrl`.

**UI changes (`dashboard.integrations.tsx`):**
- Replace the single `apiKey` input + the UberEats-only block with a generic `<CredentialForm platform={picked} values={...} />` driven by the schema above.
- Top of the form: a toggle **"I have real credentials"** vs **"Continue with demo"**.
  - Demo mode: fills `apiKey` with `demoKeyFor(platform)` and disables the real fields. Clicking Connect uses the existing mock adapter — unchanged behavior.
  - Real mode: shows the platform-specific fields with the labels from the table above, plus a small "Where do I find these?" link (`helpUrl`).
- Submit posts the collected values to `connectPlatform(...)`.

**Type + adapter changes:**
- Extend `ConnectInput` in `src/server/platforms/types.ts` with an open-ended `credentials?: Record<string, string>` map (keeps existing `apiKey`/`clientId`/`clientSecret`/`storeId` for back-compat).
- Update `createMockAdapter`: if `credentials` is non-empty (real mode), accept any non-empty values and skip the demo-key check, returning a fake but realistic-looking token. If `credentials` is empty, keep the current `demo-<platform>-key` validation.
- `createUberEatsAdapter`: read from `credentials.client_id / client_secret / store_uuid` first, fall back to existing fields.
- Add stub adapters for DoorDash and Grubhub later if needed; for now the mock with real-mode pass-through is enough.

**Storage:** Real credentials are stored encrypted-at-rest by Supabase as part of `integrations.config` (jsonb). We'll store `credentials` under `config.credentials` and never log them. Webhook URL/secret display in the card stays as is.

---

## 2. Fix `menu_item_availability.created_at does not exist`

The `get_columns` RPC orders by something that assumes `created_at`, and the admin UI also passes `orderBy: { column: "created_at" }` to `getAll`, which fails on tables that don't have it. The migration `integrations_full_setup.sql` defines `menu_item_availability` with only `updated_at`, no `created_at`.

**Two fixes (apply both):**

**a) Add the missing column** — new migration `add_created_at_to_menu_item_availability.sql`:
```sql
alter table public.menu_item_availability
  add column if not exists created_at timestamptz not null default now();
```

**b) Make admin table viewer resilient** — in `src/routes/_authenticated/admin.tables.tsx`, only pass `orderBy: created_at` when the active table's columns include `created_at`; otherwise order by `id`. This prevents the same crash for any future table without `created_at`.

---

## 3. Categories section is empty — explanation + fix

**Purpose of `categories`:** groups menu items (e.g. "Starters", "Mains", "Desserts", "Drinks"). Each `menu_items` row has an optional `category_id` referencing `categories.id`. This is what powers section headers on a public menu, filtering in the dashboard menu page, and per-section sync to delivery platforms.

**Why it appears empty in admin:** the table has zero rows because no UI ever creates categories — the menu page lets you create items but not categories. So when you click "categories" in the admin tables sidebar, it correctly shows 0 rows.

**Fix in this round:**
- Add a small **Categories manager** to `dashboard.menu.tsx`: list existing categories, add new (name + sort_order), rename, delete (with confirm if items are still attached).
- In the menu item create/edit dialog, replace the free-text/empty category selector with a `<Select>` populated from the categories list, plus an inline "New category…" option.
- Service helpers go in `src/services/menu.ts` (`createCategory`, `updateCategory`, `deleteCategory`).

This way Categories stops being a dead table and becomes meaningful: items grouped → cleaner menu UI → cleaner platform syncs.

---

## Files to create / edit

**New**
- `src/server/platforms/credentials.ts` — per-platform field schemas
- `src/components/integrations/CredentialForm.tsx` — generic dynamic form
- `add_created_at_to_menu_item_availability.sql` — migration
- `src/components/menu/CategoryManager.tsx` — list/add/edit/delete categories

**Edited**
- `src/server/platforms/types.ts` — add `credentials` map to `ConnectInput`
- `src/server/platforms/mock.ts` — accept real credentials and skip demo-key check when present
- `src/server/platforms/ubereats.ts` — read from `credentials` map
- `src/routes/_authenticated/dashboard.integrations.tsx` — demo/real toggle + dynamic form
- `src/routes/_authenticated/admin.tables.tsx` — guard `orderBy` against missing `created_at`
- `src/routes/_authenticated/dashboard.menu.tsx` — mount CategoryManager + use category Select
- `src/services/menu.ts` — category CRUD helpers

---

## Action required from you after I implement

Run the new migration in your Supabase SQL editor:

```sql
alter table public.menu_item_availability
  add column if not exists created_at timestamptz not null default now();
```

Then the admin tables view for `menu_item_availability` will load, and the Categories tab will start filling up as you add categories from the menu page.
