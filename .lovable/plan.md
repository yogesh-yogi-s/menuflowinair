## Goal

Replace the user-provided `GEMINI_API_KEY` integration with the **Lovable AI Gateway** (same pattern already used by the AI Menu Creator), and re-implement **Feature 1 — Describe-from-photo** and **Feature 2 — Translate menu** cleanly. Drop the cron / Daily Summary work entirely.

## What gets removed

- `GEMINI_API_KEY` secret (deleted via secrets tool).
- `CRON_SECRET` secret.
- All Daily Summary code:
  - `src/components/dashboard/YesterdaySummaryCard.tsx`
  - `src/routes/api/ai/generate-summary-now.ts`
  - `src/routes/api/public/cron/daily-summary.ts`
  - `src/server/ai/summary.server.ts`
  - `src/services/summaries.ts`
  - `summarizeDay()` in gemini.server.ts
  - `YesterdaySummaryCard` usage on dashboard index
  - `timezone` field UI on profile page (column stays in DB, harmless)
- The custom Gemini REST client `src/server/ai/gemini.server.ts` (replaced).

## What gets rebuilt (using Lovable AI Gateway)

### New shared server module — `src/server/ai/lovable-ai.server.ts`
- Reads `LOVABLE_API_KEY` from `process.env` (auto-provisioned by Lovable Cloud, same as `generate-menu.ts` already uses).
- Posts to `https://ai.gateway.lovable.dev/v1/chat/completions`.
- Default model: `google/gemini-3-flash-preview`.
- Two helpers:
  - `describeImageFromUrl(imageUrl)` → uses tool-calling for structured output `{ name, description, suggested_price, category_guess }`. Sends the image as an `image_url` content part (OpenAI-compatible vision format) — no manual base64 download, works on Workers.
  - `translateMenuBatch(locale, items, categories)` → tool-calling with a strict schema, returns `{ items: [...], categories: [...] }`.
- Centralized error handling for **402** ("Add credits to your Lovable AI workspace") and **429** ("Rate limit, please retry") so the UI can surface a proper toast.

### Feature 1 — Describe-from-photo
- Endpoint `src/routes/api/ai/describe-photo.ts` rewritten:
  - Auth: bearer token via Supabase (unchanged).
  - Calls `describeImageFromUrl()` from the new module.
  - Returns `{ dish: { name, description, suggested_price, category_guess } }`.
- Frontend `DescribeFromPhotoDialog.tsx`: no change needed (same response shape).
- Surfaces 402 / 429 errors as toasts.

### Feature 2 — Translate menu
- Endpoint `src/routes/api/ai/translate-menu.ts` rewritten:
  - Auth via bearer token.
  - Loads owner's items + categories via service-role client (unchanged DB logic).
  - Calls `translateMenuBatch()` from the new module.
  - Upserts into `menu_item_translations` / `category_translations`.
- Frontend `TranslateMenuDialog.tsx`: unchanged.

## Bug fixes folded in

- Replace the manual `fetchImageAsBase64 → Buffer.from()` path (Buffer is unreliable on the Worker runtime for large images) with the gateway's native `image_url` vision input.
- Stop relying on a user-supplied secret that may be missing/invalid → eliminates "GEMINI_API_KEY not configured" runtime errors.
- Remove the cron route so missing `CRON_SECRET` no longer causes a startup-time check.
- Remove `summary.server.ts` import chain that was pulling server-only modules toward the client through `dashboard.index.tsx`.

## Verification

1. `bun run` typecheck via the auto build.
2. `stack_modern--invoke-server-function` POST to `/api/ai/describe-photo` and `/api/ai/translate-menu` with a stub bearer to confirm 401 (proves route is mounted, no startup crash).
3. Check `server-function-logs` for any `LOVABLE_API_KEY not configured` — should be absent because Lovable Cloud is enabled.

## Files touched

**Delete:** 5 files listed above.
**Rewrite:** `src/routes/api/ai/describe-photo.ts`, `src/routes/api/ai/translate-menu.ts`, replace `gemini.server.ts` with `lovable-ai.server.ts`.
**Edit:** `src/routes/_authenticated/dashboard.index.tsx` (remove summary card), `src/routes/_authenticated/dashboard.profile.tsx` (remove timezone field if present).
**Secrets:** delete `GEMINI_API_KEY` and `CRON_SECRET`; ensure `LOVABLE_API_KEY` exists (enable AI Gateway if not).
