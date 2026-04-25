import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/database.types";

export type IntegrationRow = Database["public"]["Tables"]["integrations"]["Row"];
export type IntegrationUpdate = Database["public"]["Tables"]["integrations"]["Update"];
export type IntegrationInsert = Database["public"]["Tables"]["integrations"]["Insert"];

export async function listIntegrations(): Promise<IntegrationRow[]> {
  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .order("platform", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateIntegration(id: string, payload: IntegrationUpdate): Promise<IntegrationRow> {
  const { data, error } = await supabase
    .from("integrations")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createIntegration(payload: IntegrationInsert): Promise<IntegrationRow> {
  const { data, error } = await supabase
    .from("integrations")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteIntegration(id: string): Promise<void> {
  const { error } = await supabase.from("integrations").delete().eq("id", id);
  if (error) throw error;
}

export async function logSync(integrationId: string | null, status: "success" | "error", message?: string) {
  const { error } = await supabase.from("sync_logs").insert({
    integration_id: integrationId,
    status,
    message: message ?? null,
  });
  if (error) throw error;
}