# Plan: Real Integrations CRUD + AI-Powered Menu Generator

## 1. Integrations Page (`src/routes/_authenticated/dashboard.integrations.tsx`)

Convert from passive list to full CRUD bound to the `integrations` table.

**Behavior**
- Fetch existing rows for the logged-in user (RLS already filters by `owner_id`) and render each as a card showing platform name, status badge, last-synced time.
- **Add Integration button** opens a modal listing available platforms (Zomato, Swiggy, UberEats, DoorDash, Grubhub) — only those not already connected are selectable. Selecting one inserts a new row: `{ platform, status: 'connected', enabled: true, owner_id: user.id }`.
- **Enable toggle** on each card flips the `enabled` column (and updates `status` to `connected`/`disconnected`) via update mutation.
- **Disconnect button** on each card prompts confirmation, then deletes the row from Supabase.
- All mutations invalidate the `["integrations"]` query for instant UI refresh; toasts on success/error.

**Service additions** (`src/services/integrations.ts`)
- `createIntegration(payload)` — insert a row.
- `deleteIntegration(id)` — delete a row.

## 2. AI Menu Generator (`src/routes/_authenticated/dashboard.ai-tools.tsx`)

Replace the hardcoded `sampleResults` with a real AI call through the **Lovable AI Gateway** (the project's standard pattern for runtime AI features).

**New edge route**: `src/routes/api/ai/generate-menu.ts`
- POST handler that accepts `{ prompt: string }`.
- Calls Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) with `LOVABLE_API_KEY` from env, model `google/gemini-2.5-flash`, using **tool calling** with a strict JSON schema:
  ```ts
  { items: [{ name: string, description: string, price: number, category: string }] }
  ```
- System prompt instructs the model to generate brand-new menu items strictly derived from the user's text (cuisine, vibe, price range mentioned).
- Handles 429/402 with friendly error messages.
- Returns parsed `items[]` to the client.

**Frontend changes**
- Replace `setTimeout` mock with `fetch('/api/ai/generate-menu', { method: 'POST', body: JSON.stringify({ prompt: input }) })`.
- Render results as cards (already in place) populated from the AI response.
- Per-card **Save to Menu** button → `createMenuItem({ name, description, price, available: true, owner_id: user.id })`.
- New **Save All** button → iterates and inserts all generated items, then invalidates `["menu_items"]` and toasts a count.
- Loading + error states surfaced via toasts and disabled buttons.

## 3. Setup notes for the user

- **Secret required**: `LOVABLE_API_KEY` — already provisioned in Lovable Cloud sandboxes; if missing the edge route returns a clear error telling you to add it.
- No database changes needed — `integrations` and `menu_items` tables and RLS already exist from the prior migration.

## Files to change / create

- edit  `src/routes/_authenticated/dashboard.integrations.tsx` — cards, add modal, toggle, disconnect
- edit  `src/services/integrations.ts` — add `createIntegration`, `deleteIntegration`
- edit  `src/routes/_authenticated/dashboard.ai-tools.tsx` — real AI fetch + Save All
- create `src/routes/api/ai/generate-menu.ts` — server route calling Lovable AI Gateway

No schema migrations required.