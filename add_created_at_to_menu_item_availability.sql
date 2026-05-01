-- Run in your Supabase SQL Editor.
-- Adds the missing created_at column so the admin tables viewer can sort it.
alter table public.menu_item_availability
  add column if not exists created_at timestamptz not null default now();