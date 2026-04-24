## Goal

Wire this MenuFlow app to YOUR existing Supabase project (`hfazhaizygooazflusfm`), replacing the current mock data and mock auth with real email/password authentication, a restaurant menu schema, and full CRUD — plus a generic `/admin/tables` browser for any table.

> Security note: the password you pasted in chat is now public. **Rotate it in Supabase → Project Settings → Database → Reset password before continuing.** We will NOT use the postgres password — apps on Cloudflare Workers cannot open raw Postgres. We use the Supabase JS client over HTTPS with the **anon (publishable) key**.

## What I need from you (after approving the plan)

Two values from your Supabase dashboard → Project Settings → API:
1. **Project URL** — `https://hfazhaizygooazflusfm.supabase.co`
2. **anon public key** (the long JWT starting with `eyJ…`) — safe to bundle in the frontend

I'll add these as secrets (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) — never hardcoded.

## Database schema (run via SQL in your Supabase project)

I'll provide a single SQL migration you paste into Supabase → SQL Editor. Tables:

- **profiles** — `id (uuid → auth.users)`, `full_name`, `restaurant_name`, timestamps. Auto-created via trigger on signup.
- **user_roles** — `id`, `user_id`, `role` (enum: `admin`, `owner`, `staff`). Separate table to prevent privilege escalation. Includes `has_role()` security-definer function.
- **categories** — `id`, `owner_id`, `name`, `sort_order`.
- **menu_items** — `id`, `owner_id`, `category_id` (FK), `name`, `description`, `price`, `available`, `image_url`, timestamps.
- **integrations** — `id`, `owner_id`, `platform` (DoorDash/UberEats/Grubhub/…), `status`, `enabled`, `last_synced_at`, `config jsonb`.
- **sync_logs** — `id`, `owner_id`, `integration_id` (FK), `status`, `message`, `created_at`.

**RLS on every table**: users can only see/modify rows where `owner_id = auth.uid()`. Admins (`has_role(auth.uid(), 'admin')`) can see everything — that's what powers the generic `/admin/tables` browser.

## Frontend changes

```text
src/
├── integrations/supabase/
│   ├── client.ts           # createClient(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)
│   └── types.ts            # generated DB types (I'll inline a hand-written version)
├── services/
│   ├── crud.ts             # generic getAll/getById/create/update/remove with filters/pagination/sort
│   ├── menu.ts             # typed wrappers for menu_items + categories
│   ├── integrations.ts     # typed wrappers for integrations + sync_logs
│   └── profile.ts          # profile + role helpers
├── hooks/
│   ├── use-auth.tsx        # AuthProvider — session, user, signIn/signUp/signOut
│   └── use-table.tsx       # generic React Query hook for any table (list/single/mutate)
├── routes/
│   ├── __root.tsx          # add AuthProvider + QueryClientProvider
│   ├── login.tsx           # REAL signIn → redirect param
│   ├── signup.tsx          # REAL signUp + emailRedirectTo
│   ├── _authenticated.tsx  # NEW pathless layout — beforeLoad guards
│   ├── _authenticated/dashboard.tsx           # moved
│   ├── _authenticated/dashboard.index.tsx     # menu CRUD against Supabase
│   ├── _authenticated/dashboard.integrations.tsx  # integrations CRUD
│   ├── _authenticated/dashboard.ai-tools.tsx
│   └── _authenticated/admin.tables.tsx        # NEW generic table browser (admin role only)
└── components/
    ├── crud/DataTable.tsx       # generic sortable/paginated table
    ├── crud/RecordForm.tsx      # generic form built from column metadata
    └── crud/ConfirmDelete.tsx
```

**TanStack Query** (`@tanstack/react-query`) wraps all data access for caching, loading/empty/error states, and optimistic updates.

## Auth flow

- `useAuth` sets up `onAuthStateChange` BEFORE `getSession()` (Supabase requirement).
- Session persisted in `localStorage` by the Supabase client.
- `_authenticated.tsx` uses `beforeLoad` + `redirect({ to: "/login", search: { redirect: location.href } })` — proper guard, no flash of protected content.
- `login.tsx` reads `?redirect=` and navigates back after success.
- Logout button in `DashboardSidebar`.
- Signup auto-creates a `profiles` row via trigger (`handle_new_user`).

## Generic CRUD layer (`services/crud.ts`)

```ts
getAll(table, { filters, orderBy, page, pageSize })
getById(table, id)
createRecord(table, data)
updateRecord(table, id, data)
deleteRecord(table, id)
listTables()                  // calls a SQL function exposing public.* table names
getColumns(tableName)         // calls information_schema via RPC
```

Two small SQL functions (`public.list_tables()`, `public.get_columns(text)`) — both `SECURITY DEFINER`, restricted to admins via `has_role` — power the generic browser without exposing `pg_catalog` directly.

## `/admin/tables` browser

- Sidebar lists all `public.*` tables.
- Picking a table fetches columns + rows (paginated, sortable, filterable).
- Row actions: edit (auto-form), delete (confirm dialog), add new.
- Guarded by `_authenticated` + role check (`has_role(uid, 'admin')`); non-admins get a 403 view.

## Existing dashboard pages — wired to real data

- **Menu Management** (`dashboard.index.tsx`) — replaces `useState(initialItems)` with `useQuery(['menu_items'])` + mutations. Add/edit dialog calls `createRecord`/`updateRecord`. Sync button writes a row to `sync_logs`.
- **Integrations** (`dashboard.integrations.tsx`) — fetches from `integrations`, toggle calls `updateRecord`.
- **Landing page** stays public; CTAs route to `/signup`.

## Setup steps you'll do

1. Rotate the leaked DB password.
2. Paste your **Project URL** and **anon key** into the Lovable secret prompt I'll send.
3. Open Supabase → SQL Editor → paste the migration I'll output → Run.
4. (Optional) In Supabase → Authentication → URL Configuration, set Site URL to your Lovable preview URL so email confirmation links work. For dev, you can also disable "Confirm email" temporarily.
5. Sign up in the app — `profiles` row + default `owner` role created automatically.
6. To use `/admin/tables`, manually add an `admin` role row in Supabase Table Editor for your user.

## Out of scope (ask separately if needed)

- Storage bucket for menu item images (placeholder URL field for now).
- Realtime subscriptions.
- Edge functions for the actual DoorDash/UberEats sync — only the schema + UI shell.
- Server-side rendering of authenticated pages.

## Approval

Reply **approve** and I'll: send a secret-input prompt for the URL + anon key, output the SQL migration for you to run, then implement all the code above.