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