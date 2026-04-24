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