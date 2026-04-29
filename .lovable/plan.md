## Fix Supabase env vars not loading

The runtime error `supabaseUrl is required` means Vite is starting without `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` in the environment. You've now provided the values, so we'll write them to `.env` at the project root and restart the dev server.

### Steps

1. **Create `.env`** at the project root with:
   ```
   VITE_SUPABASE_URL=https://hfazhaizygooazflusfm.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmYXpoYWl6eWdvb2F6Zmx1c2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NDI2MzcsImV4cCI6MjA5MjUxODYzN30.nNfOH-2H1BhUfC9Xt1bXhHzy7NtXqpEf1k2-rcKdd44
   ```
   Also mirror the values as `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in the same file so server functions / SSR (e.g. `src/routes/api/ai/generate-menu.ts`) can read them via `process.env.*`.

2. **Confirm `.gitignore`** no longer ignores `.env` (was already removed in a prior step). Verify after writing.

3. **Restart the Vite dev server** so the new env vars are picked up. Vite only reads `.env` at startup.

4. **Verify in preview**: reload the app, confirm the `supabaseUrl is required` runtime error is gone, and that login/signup still work.

### Notes

- The publishable (anon) key is safe to commit — it's a public key gated by RLS.
- No code changes needed; `src/integrations/supabase/client.ts` already reads these names correctly.
- If the error persists after restart, we'll inspect `import.meta.env` at runtime to confirm Vite picked up the file.