import { supabase } from "@/integrations/supabase/client";

export type RangeKey = "today" | "7d" | "30d" | "90d";

export const RANGE_LABEL: Record<RangeKey, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

export function rangeStart(range: RangeKey): Date {
  const now = new Date();
  if (range === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d;
}

export function previousRangeStart(range: RangeKey): Date {
  const start = rangeStart(range);
  const days = range === "today" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const d = new Date(start);
  d.setDate(d.getDate() - days);
  return d;
}

export interface Kpis {
  revenue: number;
  orders: number;
  aov: number;
  rejectionRate: number;
  revenueDelta: number; // percent vs previous period (can be Infinity)
  ordersDelta: number;
}

function pctDelta(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

export async function getKpis(range: RangeKey): Promise<Kpis> {
  const start = rangeStart(range).toISOString();
  const prevStart = previousRangeStart(range).toISOString();

  const { data: curr, error: e1 } = await supabase
    .from("platform_orders")
    .select("total, status")
    .gte("placed_at", start);
  if (e1) throw e1;

  const { data: prev, error: e2 } = await supabase
    .from("platform_orders")
    .select("total, status")
    .gte("placed_at", prevStart)
    .lt("placed_at", start);
  if (e2) throw e2;

  const valid = (curr ?? []).filter((o) => o.status !== "rejected" && o.status !== "cancelled");
  const validPrev = (prev ?? []).filter((o) => o.status !== "rejected" && o.status !== "cancelled");

  const revenue = valid.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const orders = valid.length;
  const revenuePrev = validPrev.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const ordersPrev = validPrev.length;

  const total = (curr ?? []).length;
  const rejected = (curr ?? []).filter((o) => o.status === "rejected" || o.status === "cancelled").length;

  return {
    revenue,
    orders,
    aov: orders > 0 ? revenue / orders : 0,
    rejectionRate: total > 0 ? Math.round((rejected / total) * 100) : 0,
    revenueDelta: pctDelta(revenue, revenuePrev),
    ordersDelta: pctDelta(orders, ordersPrev),
  };
}

export interface RevenuePoint {
  day: string;
  [platform: string]: string | number;
}

export async function getRevenueByPlatform(range: RangeKey): Promise<{
  data: RevenuePoint[];
  platforms: string[];
}> {
  const start = rangeStart(range).toISOString();
  const { data, error } = await supabase
    .from("v_orders_daily")
    .select("*")
    .gte("day", start)
    .order("day", { ascending: true });
  if (error) throw error;

  const platforms = Array.from(new Set((data ?? []).map((d) => d.platform)));
  const byDay = new Map<string, RevenuePoint>();
  for (const row of data ?? []) {
    const key = new Date(row.day).toISOString().slice(0, 10);
    if (!byDay.has(key)) {
      const seed: RevenuePoint = { day: key };
      for (const p of platforms) seed[p] = 0;
      byDay.set(key, seed);
    }
    const point = byDay.get(key)!;
    point[row.platform] = Number(row.revenue);
  }
  return { data: Array.from(byDay.values()), platforms };
}

export interface OrdersTimePoint {
  bucket: string;
  orders: number;
}

export async function getOrdersTimeseries(range: RangeKey): Promise<OrdersTimePoint[]> {
  const start = rangeStart(range).toISOString();
  const bucketByHour = range === "today";

  const { data, error } = await supabase
    .from("platform_orders")
    .select("placed_at, status")
    .gte("placed_at", start);
  if (error) throw error;

  const valid = (data ?? []).filter((o) => o.status !== "rejected" && o.status !== "cancelled");
  const buckets = new Map<string, number>();
  for (const o of valid) {
    const d = new Date(o.placed_at);
    let key: string;
    if (bucketByHour) {
      d.setMinutes(0, 0, 0);
      key = d.toISOString();
    } else {
      d.setHours(0, 0, 0, 0);
      key = d.toISOString().slice(0, 10);
    }
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, orders]) => ({ bucket, orders }));
}

export interface TopItem {
  name: string;
  qty: number;
  revenue: number;
}

export async function getTopItems(limit = 10): Promise<TopItem[]> {
  const { data, error } = await supabase
    .from("v_top_items")
    .select("*")
    .order("qty", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    name: r.name,
    qty: Number(r.qty),
    revenue: Number(r.revenue),
  }));
}

export interface SyncHealthRow {
  id: string;
  platform: string;
  status: string;
  last_sync_status: string | null;
  last_sync_message: string | null;
  last_synced_at: string | null;
  errors_24h: number;
}

export async function getSyncHealth(): Promise<SyncHealthRow[]> {
  const { data: integrations, error } = await supabase.from("integrations").select("*");
  if (error) throw error;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: errors } = await supabase
    .from("sync_logs")
    .select("integration_id, status, created_at")
    .gte("created_at", since)
    .eq("status", "error");

  const errCount = new Map<string, number>();
  for (const r of errors ?? []) {
    if (!r.integration_id) continue;
    errCount.set(r.integration_id, (errCount.get(r.integration_id) ?? 0) + 1);
  }

  return (integrations ?? []).map((i) => ({
    id: i.id,
    platform: i.platform,
    status: i.status,
    last_sync_status: i.last_sync_status,
    last_sync_message: i.last_sync_message,
    last_synced_at: i.last_synced_at,
    errors_24h: errCount.get(i.id) ?? 0,
  }));
}