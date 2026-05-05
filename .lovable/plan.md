## Three AI features powered by Google Gemini

We'll add three time-saving AI tools to your dashboard, all powered by your own Google Gemini API key (stored as a project secret, called only from the server — never exposed to the browser).

---

### 1. Describe-from-photo (dish image → menu item)

**Where:** New "Describe from photo" button on the Menu page, plus an option inside the existing "Add menu item" dialog.

**Flow:**
- Owner uploads a photo (drag/drop or file picker) **or** pastes a public image URL.
- Uploaded files go to a new public Supabase Storage bucket `dish-photos` (10MB limit, owner-scoped RLS).
- Server function calls **Gemini 1.5 Flash (vision)** with the image and returns: `{ name, description, suggested_price, category_guess }`.
- Result appears in a preview card — owner can edit then click "Add to menu" (creates a `menu_items` row, linking the photo URL to a new `image_url` column).

---

### 2. One-click menu translation

**Storage:** New `menu_item_translations` table:
```
id, menu_item_id (fk), locale (text), name, description,
ai_generated (bool), created_at, updated_at
unique(menu_item_id, locale)
```
Plus `category_translations` (same shape) so category names translate too.

**UI:** On the Menu page header, a "Translate menu" button opens a dialog:
- Locale dropdown preloaded with **French (fr), Spanish (es), Hindi (hi), Arabic (ar)** + free-text for any ISO code.
- "Translate all" button → server function batches all items + categories into a single Gemini call (JSON mode, structured output) and upserts rows.
- Per-item override: edit the translated name/description inline; sets `ai_generated=false`.
- Public menu (`/m/$slug`) gets a `?lang=fr` query param + a small language switcher; falls back to original when a translation is missing.

---

### 3. Daily summary email (8 AM local time)

**What it sends:** AI-written one-paragraph summary of yesterday — total revenue, order count, top item, any platform sync failures, biggest miss.

**Pieces:**
1. Add `timezone` column to `profiles` (default `UTC`, owner editable in Profile page).
2. New table `daily_summaries (id, owner_id, summary_date, stats jsonb, ai_text, email_sent_at)` for idempotency + history view.
3. **Email infrastructure:** Set up Lovable Emails domain (you'll be prompted to add NS records at your registrar — one-time, ~5 min).
4. Transactional email template `daily-summary` (React Email).
5. Public cron endpoint `/api/public/cron/daily-summary` runs **every hour** via pg_cron — for each owner whose local time is 8 AM and not yet sent today, it:
   - Aggregates yesterday's `orders` + `platform_sync_logs`
   - Calls Gemini for the natural-language summary
   - Enqueues the email via `sendTransactionalEmail`
   - Writes a row to `daily_summaries`
6. **Dashboard widget:** A "Yesterday's summary" card on the overview shows the latest summary so it's also visible in-app.

---

### Shared infrastructure

- **Secret:** I'll prompt you to paste your `GEMINI_API_KEY` (stored as a runtime secret, server-only).
- **One Gemini client module** (`src/server/ai/gemini.server.ts`) with helpers: `describeImage`, `translateBatch`, `summarizeDay`. All other code calls these — easy to swap models later.
- **Server functions** (not Edge Functions) for all AI calls, following the TanStack pattern already in your repo.
- **Rate limit + error handling:** 429/402 errors surface as toast messages; failed translations/summaries are retried up to 3× then logged.

---

### Files to be created / edited

**New SQL migrations**
- `menu_item_translations` + `category_translations` tables with RLS
- `daily_summaries` table with RLS
- `dish-photos` storage bucket + policies
- `image_url` column on `menu_items`
- `timezone` column on `profiles`
- pg_cron job for daily summary

**New files**
- `src/server/ai/gemini.server.ts` — Gemini client + helpers
- `src/server/ai/menu.functions.ts` — `describeFromPhoto`, `translateMenu` server fns
- `src/services/translations.ts` — CRUD for translations
- `src/components/menu/DescribeFromPhotoDialog.tsx`
- `src/components/menu/TranslateMenuDialog.tsx`
- `src/components/menu/LanguageSwitcher.tsx`
- `src/components/dashboard/YesterdaySummaryCard.tsx`
- `src/lib/email-templates/daily-summary.tsx`
- `src/routes/api/public/cron.daily-summary.ts`
- `src/services/storage.ts` (dish-photos upload helper)

**Edited files**
- `src/components/menu/CategoryManager.tsx` — show translation count badge
- `src/routes/_authenticated/dashboard.menu.tsx` — add new buttons
- `src/routes/_authenticated/dashboard.index.tsx` — mount summary card
- `src/routes/_authenticated/dashboard.profile.tsx` — timezone picker
- `src/components/menu/PublicMenuView.tsx` + `src/routes/m.$slug.tsx` — language switching
- `src/lib/email-templates/registry.ts` — register daily-summary template

---

### Order of execution after approval

1. Ask you for the `GEMINI_API_KEY` and trigger Lovable Emails domain setup dialog.
2. Once both are ready, run all migrations.
3. Build feature 1 (photo) → feature 2 (translate) → feature 3 (daily email).
4. Verify with a test send and a sample translation.