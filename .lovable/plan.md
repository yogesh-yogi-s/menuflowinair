## Implementation — ready to execute

You provided the anon key. Below is exactly what I'll do as soon as you approve this revised plan.

### Step 1 — Local config (I'll create)

Create `.env` (gitignored automatically by Vite):
```
VITE_SUPABASE_URL=https://hfazhaizygooazflusfm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmYXpoYWl6eWdvb2F6Zmx1c2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NDI2MzcsImV4cCI6MjA5MjUxODYzN30.nNfOH-2H1BhUfC9Xt1bXhHzy7NtXqpEf1k2-rcKdd44
```

### Step 2 — SQL migration (you'll paste into Supabase → SQL Editor → Run)

I'll output a single migration that creates: `app_role` enum, `profiles`, `user_roles`, `categories`, `menu_items`, `integrations`, `sync_logs`; the `has_role()` security-definer function; the `handle_new_user()` trigger that auto-creates a profile + default `owner` role on signup; RLS policies (owner-scoped + admin-bypass); `list_tables()` and `get_columns()` admin RPCs for the generic browser; sensible indexes (`owner_id`, `category_id`, `created_at`).

### Step 3 — Code I'll write

```
src/integrations/supabase/client.ts          # createClient with localStorage session
src/integrations/supabase/types.ts           # hand-written Database type
src/services/crud.ts                          # generic getAll/getById/create/update/remove
src/services/menu.ts                          # typed menu_items + categories helpers
src/services/integrations.ts                  # typed integrations + sync_logs helpers
src/services/profile.ts                       # profile + has_role helpers
src/hooks/use-auth.tsx                        # AuthProvider, useAuth (onAuthStateChange first)
src/components/crud/DataTable.tsx             # generic sortable/paginated table
src/components/crud/RecordForm.tsx            # generic form from column metadata
src/components/crud/ConfirmDelete.tsx
src/routes/__root.tsx                         # +AuthProvider +QueryClientProvider
src/router.tsx                                # +QueryClient per request, defaultPreloadStaleTime:0
src/routes/login.tsx                          # REAL signIn + ?redirect= support
src/routes/signup.tsx                         # REAL signUp w/ emailRedirectTo
src/routes/_authenticated.tsx                 # NEW pathless layout — beforeLoad guard
src/routes/_authenticated/dashboard.tsx       # moved from src/routes/dashboard.tsx
src/routes/_authenticated/dashboard.index.tsx # real menu CRUD
src/routes/_authenticated/dashboard.integrations.tsx
src/routes/_authenticated/dashboard.ai-tools.tsx
src/routes/_authenticated/admin.tables.tsx    # admin-only generic browser
src/components/DashboardSidebar.tsx           # +logout button, +Admin link if admin
```

(Old `src/routes/dashboard*.tsx` and the un-prefixed `dashboard*` route files get removed/moved into `_authenticated/`.)

### Step 4 — Setup actions you'll perform after I'm done

1. **Rotate the leaked DB password** (Supabase → Project Settings → Database → Reset password). Critical.
2. **Run the SQL migration** I'll output, in Supabase → SQL Editor.
3. In Supabase → Authentication → URL Configuration → set **Site URL** to your Lovable preview URL so signup confirmation links work. For faster dev, optionally toggle off "Confirm email" under Auth → Providers → Email.
4. Sign up in the app. To grant yourself admin access for `/admin/tables`, run in SQL Editor:
   ```sql
   insert into public.user_roles (user_id, role)
   values ((select id from auth.users where email = 'you@example.com'), 'admin');
   ```

### Approve to proceed

Reply **approve** (or just "go") and I'll write all the files + output the SQL migration in one batch.