import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/integrations/supabase/database.types";

export async function hasRole(userId: string, role: AppRole): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: role });
  if (error) {
    console.error("has_role error", error);
    return false;
  }
  return Boolean(data);
}

export async function getMyRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) {
    console.error("getMyRoles error", error);
    return [];
  }
  return (data ?? []).map((r) => r.role);
}

export interface ProfileRow {
  id: string;
  full_name: string | null;
  restaurant_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  slug: string | null;
  tagline: string | null;
  created_at: string;
  updated_at: string;
}

export async function getMyProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as ProfileRow | null) ?? null;
}

export interface ProfileUpdateInput {
  full_name?: string | null;
  restaurant_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  slug?: string | null;
  tagline?: string | null;
}

export async function updateMyProfile(userId: string, input: ProfileUpdateInput): Promise<ProfileRow> {
  const { data, error } = await supabase
    .from("profiles")
    .update(input)
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return data as ProfileRow;
}

/** Lowercase, dash-separated, alphanumeric-only slug from arbitrary text. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Returns true if the slug is free (or already owned by `excludeUserId`).
 * Uses the public RPC's underlying table; RLS allows anyone to read profiles.id+slug.
 */
export async function isSlugAvailable(slug: string, excludeUserId?: string): Promise<boolean> {
  const trimmed = slug.trim();
  if (!trimmed) return false;
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("slug", trimmed)
    .maybeSingle();
  if (error) {
    console.error("isSlugAvailable error", error);
    return false;
  }
  if (!data) return true;
  return excludeUserId ? data.id === excludeUserId : false;
}