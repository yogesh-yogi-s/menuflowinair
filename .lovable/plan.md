## Goal

Extend the `profiles` table with `email`, `phone`, and `avatar_url`, keep them automatically in sync with Supabase's secure `auth.users` table, and add a Profile settings page where users can view and edit their info, change their email, and change their password.

## Important security note

Passwords are NEVER stored in `profiles` (or any custom table). Supabase already stores them as bcrypt hashes inside `auth.users` — that is the only correct place. Duplicating them would be a critical vulnerability. We will only mirror the **email** from auth (for easy querying/display) and let users change email/password through Supabase Auth APIs.

## Schema changes (migration)

Alter `public.profiles`:
- Add `email text` (unique, will be synced from `auth.users.email`)
- Add `phone text`
- Add `avatar_url text`

Update the existing `handle_new_user()` trigger function so newly created profiles also receive `email` (and `phone` if available) from `auth.users`.

Add a new trigger on `auth.users` for `AFTER UPDATE OF email` that mirrors any email change into `profiles.email`, keeping them in sync if the user changes their email later.

Backfill existing rows: `UPDATE profiles p SET email = u.email FROM auth.users u WHERE p.id = u.id AND p.email IS NULL`.

RLS policies on `profiles` remain unchanged (user can select/update their own row). The `email` column will be updatable only via the trigger pathway in practice — direct edits from the client are blocked because email changes must go through `supabase.auth.updateUser({ email })` (which sends a confirmation email).

## Code changes

**`src/integrations/supabase/database.types.ts`**
- Add `email`, `phone`, `avatar_url` to the `profiles` Row/Insert/Update types.

**`src/services/profile.ts`**
- Add `getMyProfile(userId)` — selects the full profile row.
- Add `updateMyProfile(userId, { full_name, restaurant_name, phone, avatar_url })` — updates only editable fields (NOT email).

**`src/routes/_authenticated/dashboard.profile.tsx`** (new page at `/dashboard/profile`)

Sections:
1. **Profile info** — form with Full Name, Restaurant Name, Phone, Avatar URL. Save via `updateMyProfile`.
2. **Email** — read-only display of current email + "Change email" form that calls `supabase.auth.updateUser({ email })`. Shows a toast that a confirmation link was sent to the new address.
3. **Password** — "Change password" form (new password + confirm) that calls `supabase.auth.updateUser({ password })`. Min 6 chars, both fields must match.

Use existing shadcn `Card`, `Input`, `Label`, `Button`, `sonner` toast — matches the rest of the dashboard styling.

**`src/components/DashboardSidebar.tsx`**
- Add a "Profile" nav item linking to `/dashboard/profile` (with a `User` icon from lucide-react).

## Files touched

- New SQL migration (alter profiles, update trigger, add email-sync trigger, backfill)
- New: `src/routes/_authenticated/dashboard.profile.tsx`
- Edit: `src/integrations/supabase/database.types.ts`
- Edit: `src/services/profile.ts`
- Edit: `src/components/DashboardSidebar.tsx`

## Out of scope

- Storing raw passwords anywhere outside `auth.users` (insecure — refused).
- Avatar file upload to Supabase Storage. The avatar field is a URL string for now; we can add Storage upload as a follow-up if you want.
