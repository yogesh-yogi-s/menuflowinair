import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/database.types";

export type ItemTranslationRow =
  Database["public"]["Tables"]["menu_item_translations"]["Row"];
export type CategoryTranslationRow =
  Database["public"]["Tables"]["category_translations"]["Row"];

export async function listItemTranslations(
  locale?: string,
): Promise<ItemTranslationRow[]> {
  let q = supabase.from("menu_item_translations").select("*");
  if (locale) q = q.eq("locale", locale);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function listCategoryTranslations(
  locale?: string,
): Promise<CategoryTranslationRow[]> {
  let q = supabase.from("category_translations").select("*");
  if (locale) q = q.eq("locale", locale);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function deleteItemTranslation(id: string): Promise<void> {
  const { error } = await supabase
    .from("menu_item_translations")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function updateItemTranslation(
  id: string,
  payload: { name?: string; description?: string | null; ai_generated?: boolean },
): Promise<ItemTranslationRow> {
  const { data, error } = await supabase
    .from("menu_item_translations")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCategoryTranslation(
  id: string,
  payload: { name?: string; ai_generated?: boolean },
): Promise<CategoryTranslationRow> {
  const { data, error } = await supabase
    .from("category_translations")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Per-locale counts, keyed by locale. */
export async function countItemTranslations(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("menu_item_translations")
    .select("locale");
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.locale] = (out[r.locale] ?? 0) + 1;
  return out;
}