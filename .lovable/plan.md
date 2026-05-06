# AI features — SQL bundle + code implementation

You run the SQL below in Supabase SQL Editor. I implement all the code, register the `GEMINI_API_KEY` as a project secret (you paste the value), and wire up Lovable Emails for the daily summary.

---

## Part 1 — SQL bundle (you run this in Supabase)

Run as a single script in **Supabase → SQL Editor**. Safe to re-run (idempotent where possible).

```sql
-- =========================================================
-- 1. Add columns to existing tables
-- =========================================================
alter table public.menu_items
  add column if not exists image_url text;

alter table public.profiles
  add column if not exists timezone text not null default 'UTC';

-- =========================================================
-- 2. Translations tables
-- =========================================================
create table if not exists public.menu_item_translations (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  locale text not null,
  name text not null,
  description text,
  ai_generated boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (menu_item_id, locale)
);

create table if not exists public.category_translations (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  locale text not null,
  name text not null,
  ai_generated boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, locale)
);

alter table public.menu_item_translations enable row level security;
alter table public.category_translations  enable row level security;

-- Owner full access
create policy "owners manage menu_item_translations"
  on public.menu_item_translations for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "owners manage category_translations"
  on public.category_translations for all
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Public read (so /m/:slug?lang=fr works for anonymous visitors)
create policy "public read menu_item_translations"
  on public.menu_item_translations for select to anon, authenticated
  using (true);

create policy "public read category_translations"
  on public.category_translations for select to anon, authenticated
  using (true);

-- =========================================================
-- 3. Daily summaries
-- =========================================================
create table if not exists public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  summary_date date not null,
  stats jsonb not null default '{}'::jsonb,
  ai_text text,
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, summary_date)
);

alter table public.daily_summaries enable row level security;

create policy "owners read their daily_summaries"
  on public.daily_summaries for select
  using (auth.uid() = owner_id);

-- Inserts/updates done by service role from the cron route — no policy needed.

-- =========================================================
-- 4. Storage bucket for dish photos
-- =========================================================
insert into storage.buckets (id, name, public)
values ('dish-photos', 'dish-photos', true)
on conflict (id) do nothing;

create policy "public read dish-photos"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'dish-photos');

create policy "owners upload dish-photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'dish-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "owners update own dish-photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'dish-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "owners delete own dish-photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'dish-photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- =========================================================
-- 5. pg_cron job for daily summary (runs hourly)
-- =========================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- IMPORTANT: replace <PROJECT_URL> with your project URL after I share it,
-- e.g. https://menuflowinair.lovable.app
select cron.schedule(
  'daily-summary-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://menuflowinair.lovable.app/api/public/cron/daily-summary',
    headers := '{"Content-Type":"application/json","x-cron-secret":"REPLACE_WITH_CRON_SECRET"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

After running, tell me you're done so I can register `GEMINI_API_KEY` and `CRON_SECRET` as project secrets and continue.

---

## Part 2 — Code I will implement

### Feature 1 — Describe-from-photo
- `src/services/storage.ts` — upload to `dish-photos` bucket, return public URL
- `src/server/ai/gemini.server.ts` — Gemini client (`describeImage`, `translateBatch`, `summarizeDay`)
- `src/server/ai/menu.functions.ts` — `describeFromPhoto({ image_url })` server fn → `{name, description, suggested_price, category_guess}`
- `src/components/menu/DescribeFromPhotoDialog.tsx` — drag/drop + URL input → preview → "Add to menu"
- Wire button into `dashboard.menu.tsx` + add image preview to menu table

### Feature 2 — One-click translation
- `src/services/translations.ts` — list/upsert/delete translations
- `src/server/ai/menu.functions.ts` — `translateMenu({ locale })` batches all items + categories in one Gemini call
- `src/components/menu/TranslateMenuDialog.tsx` — locale dropdown (fr/es/hi/ar + free text), "Translate all" button, per-row inline edit
- `src/components/menu/LanguageSwitcher.tsx` — small pill switcher
- Update `m.$slug.tsx` + `PublicMenuView.tsx` to read `?lang=` and merge translations with fallback
- `CategoryManager.tsx` — show translation count badge per category

### Feature 3 — Daily summary email (8 AM local)
- Lovable Emails domain setup (I'll trigger the dialog after you confirm SQL is run)
- `src/lib/email-templates/daily-summary.tsx` — React Email template
- `src/routes/api/public/cron/daily-summary.ts` — guarded by `x-cron-secret` header; for each owner whose local time is 08:xx and not yet sent today: aggregate yesterday's `platform_orders` + `sync_logs`, call Gemini, send email, insert `daily_summaries` row
- `src/components/dashboard/YesterdaySummaryCard.tsx` — shows latest summary on overview
- `dashboard.profile.tsx` — timezone picker (IANA dropdown)

### Shared
- Secrets: `GEMINI_API_KEY`, `CRON_SECRET` (I'll prompt you in the secrets form — don't paste them in chat)
- Centralized error handling: 429/402 → user-friendly toast, retries up to 3× for translate/summary

---

## Order of execution after you approve

1. You run the SQL bundle in Supabase → reply "done".
2. I prompt you for `GEMINI_API_KEY` + `CRON_SECRET` via the secure secrets form.
3. I trigger the Lovable Emails domain setup dialog (one-time DNS step at your registrar).
4. I implement Feature 1 → Feature 2 → Feature 3, verifying each before moving on.
5. I give you the final SQL snippet to paste into the cron job (replacing `REPLACE_WITH_CRON_SECRET` with the actual value you registered).

Approve this plan and I'll wait for your "SQL done" message before continuing.
