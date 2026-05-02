import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/database.types";
import type { PlatformId } from "@/server/platforms/types";
import { getAdapter } from "@/server/platforms";
import type { IntegrationConfig } from "@/services/integrations";

export type OrderStatus =
  | "received"
  | "accepted"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "rejected"
  | "cancelled";

export const ORDER_STATUSES: OrderStatus[] = [
  "received",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "rejected",
  "cancelled",
];

/** Defines the next valid forward step(s) from each status. */
export const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  received: ["accepted", "rejected"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["out_for_delivery", "completed", "cancelled"],
  out_for_delivery: ["completed", "cancelled"],
  completed: [],
  rejected: [],
  cancelled: [],
};

export function isTerminal(status: string): boolean {
  return status === "completed" || status === "rejected" || status === "cancelled";
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  received: "New",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export type OrderStatusEventRow = Database["public"]["Tables"]["order_status_events"]["Row"];

/**
 * Transition an order to a new status. Best-effort pushes the change back to
 * the source platform (via the adapter), then writes an audit event and
 * updates the order row with the appropriate timestamp.
 */
export async function transitionOrder(params: {
  orderId: string;
  ownerId: string;
  fromStatus: string;
  toStatus: OrderStatus;
  reason?: string;
}): Promise<{ adapterError?: string }> {
  const { orderId, ownerId, fromStatus, toStatus, reason } = params;

  // Look up the order to find its integration so we can call the adapter.
  const { data: order, error: orderErr } = await supabase
    .from("platform_orders")
    .select("id, platform, external_order_id, integration_id")
    .eq("id", orderId)
    .single();
  if (orderErr) throw orderErr;

  let adapterError: string | undefined;
  if (order.integration_id) {
    const { data: integration } = await supabase
      .from("integrations")
      .select("*")
      .eq("id", order.integration_id)
      .maybeSingle();

    if (integration) {
      const cfg = (integration.config ?? {}) as IntegrationConfig;
      if (cfg.access_token && integration.external_store_id) {
        try {
          const adapter = getAdapter(integration.platform as PlatformId);
          await adapter.updateOrderStatus(
            {
              accessToken: cfg.access_token,
              storeId: integration.external_store_id,
              platform: integration.platform as PlatformId,
            },
            order.external_order_id,
            toStatus,
            reason,
          );
        } catch (e) {
          adapterError = (e as Error).message;
          console.warn("Adapter status push failed:", e);
        }
      }
    }
  }

  // Write audit event first (so it's never lost if the update fails).
  await supabase.from("order_status_events").insert({
    owner_id: ownerId,
    order_id: orderId,
    from_status: fromStatus,
    to_status: toStatus,
    reason: reason ?? null,
  });

  // Update the order with timestamps.
  const update: Database["public"]["Tables"]["platform_orders"]["Update"] = {
    status: toStatus,
    status_reason: reason ?? null,
  };
  if (toStatus === "accepted") update.accepted_at = new Date().toISOString();
  if (toStatus === "ready") update.ready_at = new Date().toISOString();
  if (toStatus === "completed") update.completed_at = new Date().toISOString();

  const { error: updErr } = await supabase
    .from("platform_orders")
    .update(update)
    .eq("id", orderId);
  if (updErr) throw updErr;

  return { adapterError };
}

export async function listOrderEvents(orderId: string): Promise<OrderStatusEventRow[]> {
  const { data, error } = await supabase
    .from("order_status_events")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  received: "secondary",
  accepted: "default",
  preparing: "default",
  ready: "default",
  out_for_delivery: "default",
  completed: "outline",
  rejected: "destructive",
  cancelled: "destructive",
};

/** Minutes since placed. Returns null when the date is invalid. */
export function ageMinutes(placedAt: string): number | null {
  const t = new Date(placedAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 60_000));
}

export function ageColor(min: number | null, slaMinutes = 20): string {
  if (min == null) return "text-muted-foreground";
  if (min < slaMinutes / 2) return "text-emerald-600 dark:text-emerald-400";
  if (min < slaMinutes) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}