import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { summarizeDay, type DayStats } from "./gemini.server";

function admin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin env not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Returns the current local hour (0-23) for an IANA timezone. */
export function localHour(tz: string, now = new Date()): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    });
    return parseInt(fmt.format(now), 10);
  } catch {
    return now.getUTCHours();
  }
}

/** Returns the local YYYY-MM-DD for an IANA timezone. */
export function localDateISO(tz: string, now = new Date()): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Subtract one day from YYYY-MM-DD. */
function previousDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Aggregate yesterday's stats (in restaurant's local day) for an owner. */
export async function buildDayStats(
  ownerId: string,
  tz: string,
): Promise<DayStats> {
  const sb = admin();
  const today = localDateISO(tz);
  const date = previousDay(today);
  // Compute UTC window for the local day [date 00:00, date+1 00:00) in tz.
  // We approximate with a wide UTC range and let JS group by local date.
  const start = new Date(`${date}T00:00:00Z`);
  start.setUTCHours(start.getUTCHours() - 14); // widest tz offset west
  const end = new Date(`${date}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  end.setUTCHours(end.getUTCHours() + 14); // widest tz offset east

  const { data: orders } = await sb
    .from("platform_orders")
    .select("platform,total,placed_at,items")
    .eq("owner_id", ownerId)
    .gte("placed_at", start.toISOString())
    .lt("placed_at", end.toISOString());

  const inDay = (orders ?? []).filter(
    (o) => localDateISO(tz, new Date(o.placed_at)) === date,
  );

  const total_orders = inDay.length;
  const total_revenue =
    Math.round(inDay.reduce((s, o) => s + Number(o.total ?? 0), 0) * 100) / 100;
  const avg_order_value =
    total_orders > 0 ? Math.round((total_revenue / total_orders) * 100) / 100 : 0;

  const platMap = new Map<string, { orders: number; revenue: number }>();
  for (const o of inDay) {
    const cur = platMap.get(o.platform) ?? { orders: 0, revenue: 0 };
    cur.orders += 1;
    cur.revenue += Number(o.total ?? 0);
    platMap.set(o.platform, cur);
  }
  const by_platform = Array.from(platMap.entries()).map(([platform, v]) => ({
    platform,
    orders: v.orders,
    revenue: Math.round(v.revenue * 100) / 100,
  }));

  const itemQty = new Map<string, number>();
  for (const o of inDay) {
    const items = (o.items ?? []) as Array<{ name?: string; qty?: number }>;
    if (!Array.isArray(items)) continue;
    for (const it of items) {
      const name = (it?.name ?? "").trim();
      if (!name) continue;
      itemQty.set(name, (itemQty.get(name) ?? 0) + Number(it.qty ?? 1));
    }
  }
  const top_items = Array.from(itemQty.entries())
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const { count: sync_errors } = await sb
    .from("sync_logs")
    .select("id", { count: "exact", head: true })
    .eq("status", "error")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());

  return {
    date,
    total_orders,
    total_revenue,
    avg_order_value,
    by_platform,
    top_items,
    sync_errors: sync_errors ?? 0,
  };
}

/** Generate (or fetch existing) daily summary for an owner. */
export async function generateAndStoreSummary(
  ownerId: string,
  tz: string,
): Promise<{ created: boolean; summary_date: string; ai_text: string | null }> {
  const sb = admin();
  const stats = await buildDayStats(ownerId, tz);

  // Already exists?
  const { data: existing } = await sb
    .from("daily_summaries")
    .select("id,ai_text")
    .eq("owner_id", ownerId)
    .eq("summary_date", stats.date)
    .maybeSingle();
  if (existing) {
    return {
      created: false,
      summary_date: stats.date,
      ai_text: existing.ai_text ?? null,
    };
  }

  let aiText: string | null = null;
  if (stats.total_orders > 0) {
    try {
      aiText = await summarizeDay(stats);
    } catch (e) {
      console.error("summarizeDay failed:", e);
    }
  } else {
    aiText = `No orders were recorded on ${stats.date}. Consider checking your integrations to make sure everything is syncing correctly.`;
  }

  await sb.from("daily_summaries").insert({
    owner_id: ownerId,
    summary_date: stats.date,
    stats: stats as unknown as Record<string, unknown>,
    ai_text: aiText,
  });

  return { created: true, summary_date: stats.date, ai_text: aiText };
}