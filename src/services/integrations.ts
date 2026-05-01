import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/database.types";
import { getAdapter, type PlatformId } from "@/server/platforms";
import type { ConnectInput, PlatformMenuItem } from "@/server/platforms/types";

export type IntegrationRow = Database["public"]["Tables"]["integrations"]["Row"];
export type IntegrationUpdate = Database["public"]["Tables"]["integrations"]["Update"];
export type IntegrationInsert = Database["public"]["Tables"]["integrations"]["Insert"];
export type PlatformOrderRow = Database["public"]["Tables"]["platform_orders"]["Row"];
export type AvailabilityRow = Database["public"]["Tables"]["menu_item_availability"]["Row"];

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

/* ---------- Connect / Sync / Orders / Availability ---------- */

/** Stored in integrations.config after a successful connect. */
export interface IntegrationConfig {
  access_token?: string;
  webhook_secret?: string;
  expires_at?: string;
  /** Real per-platform credentials, when the user supplied them. */
  credentials?: Record<string, string>;
  /** "real" | "demo" — how this integration was connected. */
  mode?: "real" | "demo";
}

export async function connectPlatform(
  platform: PlatformId,
  ownerId: string,
  credentials: ConnectInput,
): Promise<IntegrationRow> {
  const adapter = getAdapter(platform);
  const result = await adapter.connect(credentials); // throws on bad key

  const real = credentials.credentials ?? {};
  const isReal = Object.values(real).some((v) => v && v.trim().length > 0);
  const config: IntegrationConfig = {
    access_token: result.access_token,
    webhook_secret: result.webhook_secret,
    expires_at: result.expires_at,
    credentials: isReal ? real : undefined,
    mode: isReal ? "real" : "demo",
  };

  const { data, error } = await supabase
    .from("integrations")
    .insert({
      platform,
      owner_id: ownerId,
      status: "connected",
      enabled: true,
      config: config as unknown as Database["public"]["Tables"]["integrations"]["Insert"]["config"],
      external_store_id: result.store_id,
      last_sync_status: null,
      last_sync_message: "Connected",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export interface SyncOutcome {
  pushed: number;
  failed: number;
  message: string;
}

export async function syncMenuToIntegration(
  integration: IntegrationRow,
  items: PlatformMenuItem[],
): Promise<SyncOutcome> {
  const cfg = (integration.config ?? {}) as IntegrationConfig;
  if (!cfg.access_token || !integration.external_store_id) {
    throw new Error("Integration is not fully connected. Reconnect to continue.");
  }
  const adapter = getAdapter(integration.platform as PlatformId);
  let outcome: SyncOutcome;
  try {
    outcome = await adapter.syncMenu(
      {
        accessToken: cfg.access_token,
        storeId: integration.external_store_id,
        platform: integration.platform as PlatformId,
      },
      items,
    );
  } catch (e) {
    const msg = (e as Error).message || "Sync failed";
    await logSync(integration.id, "error", msg);
    await supabase
      .from("integrations")
      .update({
        last_sync_status: "error",
        last_sync_message: msg,
        status: "error",
      })
      .eq("id", integration.id);
    throw e;
  }

  const status: "success" | "error" = outcome.failed > 0 ? "error" : "success";
  await logSync(integration.id, status, outcome.message);
  await supabase
    .from("integrations")
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: status,
      last_sync_message: outcome.message,
      status: outcome.failed > 0 ? "error" : "connected",
    })
    .eq("id", integration.id);
  return outcome;
}

export async function fetchOrdersForIntegration(
  integration: IntegrationRow,
  ownerId: string,
  knownItems: PlatformMenuItem[],
): Promise<{ inserted: number }> {
  const cfg = (integration.config ?? {}) as IntegrationConfig;
  if (!cfg.access_token || !integration.external_store_id) {
    throw new Error("Integration is not fully connected.");
  }
  const adapter = getAdapter(integration.platform as PlatformId);
  const orders = await adapter.fetchOrders(
    {
      accessToken: cfg.access_token,
      storeId: integration.external_store_id,
      platform: integration.platform as PlatformId,
    },
    knownItems,
  );

  if (orders.length === 0) return { inserted: 0 };

  const rows = orders.map((o) => ({
    owner_id: ownerId,
    integration_id: integration.id,
    platform: integration.platform,
    external_order_id: o.external_order_id,
    status: "received",
    customer_name: o.customer_name,
    total: o.total,
    items: o.items as unknown as Database["public"]["Tables"]["platform_orders"]["Insert"]["items"],
    placed_at: o.placed_at,
  }));

  // Upsert on (integration_id, external_order_id) — duplicates are silently ignored.
  const { error, count } = await supabase
    .from("platform_orders")
    .upsert(rows, {
      onConflict: "integration_id,external_order_id",
      ignoreDuplicates: true,
      count: "exact",
    });
  if (error) throw error;
  return { inserted: count ?? rows.length };
}

export async function listSyncLogs(integrationId: string, limit = 5) {
  const { data, error } = await supabase
    .from("sync_logs")
    .select("*")
    .eq("integration_id", integrationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/* ---------- Orders ---------- */

export async function listPlatformOrders(): Promise<PlatformOrderRow[]> {
  const { data, error } = await supabase
    .from("platform_orders")
    .select("*")
    .order("placed_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function updateOrderStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from("platform_orders").update({ status }).eq("id", id);
  if (error) throw error;
}

/* ---------- Per-platform availability ---------- */

export async function listAvailabilityOverrides(): Promise<AvailabilityRow[]> {
  const { data, error } = await supabase.from("menu_item_availability").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function setItemPlatformAvailability(
  ownerId: string,
  menuItemId: string,
  integration: IntegrationRow,
  available: boolean,
): Promise<void> {
  const cfg = (integration.config ?? {}) as IntegrationConfig;
  if (cfg.access_token && integration.external_store_id) {
    const adapter = getAdapter(integration.platform as PlatformId);
    try {
      await adapter.setAvailability(
        {
          accessToken: cfg.access_token,
          storeId: integration.external_store_id,
          platform: integration.platform as PlatformId,
        },
        menuItemId,
        available,
      );
    } catch (e) {
      // Continue to persist locally even if remote call fails — surfaced in toast.
      console.warn("setAvailability remote call failed:", e);
    }
  }

  const { error } = await supabase
    .from("menu_item_availability")
    .upsert(
      {
        owner_id: ownerId,
        menu_item_id: menuItemId,
        integration_id: integration.id,
        available,
      },
      { onConflict: "menu_item_id,integration_id" },
    );
  if (error) throw error;
}