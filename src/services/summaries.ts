import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/database.types";

export type DailySummaryRow = Database["public"]["Tables"]["daily_summaries"]["Row"];

export async function getLatestSummary(): Promise<DailySummaryRow | null> {
  const { data, error } = await supabase
    .from("daily_summaries")
    .select("*")
    .order("summary_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}