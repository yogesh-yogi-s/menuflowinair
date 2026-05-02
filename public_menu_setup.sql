-- Run this in your Supabase SQL Editor.
-- Adds slug + tagline to profiles and a security-definer RPC that returns
-- a public restaurant's menu by slug (callable by the anon key).

-- 1. Slug + tagline columns
alter table public.profiles
  add column if not exists slug text unique,
  add column if not exists tagline text;

create index if not exists profiles_slug_idx on public.profiles(slug);

-- 2. Backfill slugs for any existing profile rows that don't have one.
update public.profiles
set slug = lower(
  regexp_replace(
    coalesce(restaurant_name, 'restaurant-' || substr(id::text, 1, 8)),
    '[^a-zA-Z0-9]+', '-', 'g'
  )
)
where slug is null;

-- 3. Public menu RPC. Returns a single jsonb document with restaurant info,
--    categories, and items. Callable by anon — only exposes published fields.
create or replace function public.get_public_menu(_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _owner uuid;
  _restaurant jsonb;
  _categories jsonb;
  _items jsonb;
begin
  select id into _owner from public.profiles where slug = _slug limit 1;
  if _owner is null then
    return null;
  end if;

  select to_jsonb(p) - 'email' - 'phone' - 'preferences' - 'updated_at'
    into _restaurant
  from (
    select id, full_name, restaurant_name, avatar_url, slug, tagline
    from public.profiles
    where id = _owner
  ) p;

  select coalesce(jsonb_agg(c order by c.sort_order, c.name), '[]'::jsonb)
    into _categories
  from (
    select id, name, sort_order
    from public.categories
    where owner_id = _owner
  ) c;

  select coalesce(jsonb_agg(i order by i.name), '[]'::jsonb)
    into _items
  from (
    select id, category_id, name, description, price, available, image_url
    from public.menu_items
    where owner_id = _owner
  ) i;

  return jsonb_build_object(
    'restaurant', _restaurant,
    'categories', _categories,
    'items', _items
  );
end;
$$;

grant execute on function public.get_public_menu(text) to anon, authenticated;