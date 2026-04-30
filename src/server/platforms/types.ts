/**
 * Common shapes used by all platform adapters (Zomato, Swiggy, UberEats, etc.).
 * Adapters are pure-frontend in this build because RLS protects the data.
 * When you swap to a real adapter that needs server-side secrets, move only
 * that adapter behind a server function — the interface stays the same.
 */

export type PlatformId = "Zomato" | "Swiggy" | "UberEats" | "DoorDash" | "Grubhub";

export interface ConnectInput {
  apiKey: string;
  // UberEats real flow can also pass clientId / clientSecret / storeId
  clientId?: string;
  clientSecret?: string;
  storeId?: string;
}

export interface ConnectResult {
  access_token: string;
  store_id: string;
  webhook_secret: string;
  expires_at?: string;
}

export interface PlatformMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  available: boolean;
}

export interface SyncResult {
  pushed: number;
  failed: number;
  message: string;
}

export interface PlatformOrder {
  external_order_id: string;
  customer_name: string;
  total: number;
  items: Array<{ name: string; qty: number; price: number }>;
  placed_at: string;
}

export interface AdapterContext {
  accessToken: string;
  storeId: string;
  platform: PlatformId;
}

export interface PlatformAdapter {
  connect(input: ConnectInput): Promise<ConnectResult>;
  syncMenu(ctx: AdapterContext, items: PlatformMenuItem[]): Promise<SyncResult>;
  fetchOrders(ctx: AdapterContext, knownItems: PlatformMenuItem[]): Promise<PlatformOrder[]>;
  setAvailability(ctx: AdapterContext, itemId: string, available: boolean): Promise<void>;
}