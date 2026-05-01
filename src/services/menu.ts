import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/database.types";

export type MenuItemRow = Database["public"]["Tables"]["menu_items"]["Row"];
export type MenuItemInsert = Database["public"]["Tables"]["menu_items"]["Insert"];
export type MenuItemUpdate = Database["public"]["Tables"]["menu_items"]["Update"];
export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

export async function listMenuItems(): Promise<MenuItemRow[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createMenuItem(payload: MenuItemInsert): Promise<MenuItemRow> {
  const { data, error } = await supabase.from("menu_items").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateMenuItem(id: string, payload: MenuItemUpdate): Promise<MenuItemRow> {
  const { data, error } = await supabase.from("menu_items").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteMenuItem(id: string): Promise<void> {
  const { error } = await supabase.from("menu_items").delete().eq("id", id);
  if (error) throw error;
}

export async function listCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type CategoryInsert = Database["public"]["Tables"]["categories"]["Insert"];
export type CategoryUpdate = Database["public"]["Tables"]["categories"]["Update"];

export async function createCategory(payload: CategoryInsert): Promise<CategoryRow> {
  const { data, error } = await supabase.from("categories").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateCategory(id: string, payload: CategoryUpdate): Promise<CategoryRow> {
  const { data, error } = await supabase
    .from("categories")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}