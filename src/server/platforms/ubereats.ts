import type {
  AdapterContext,
  ConnectInput,
  ConnectResult,
  PlatformAdapter,
  PlatformMenuItem,
  PlatformOrder,
  SyncResult,
} from "./types";
import { createMockAdapter } from "./mock";

/**
 * Real UberEats sandbox stub. When UBER_CLIENT_ID/UBER_CLIENT_SECRET are not
 * configured, this returns the mock adapter so the UI keeps working.
 *
 * To go live:
 *  1. Apply for UberEats API access at https://developer.uber.com/
 *  2. In the Connect dialog, paste your client_id, client_secret, and store_id.
 *  3. Replace the bodies below with real fetches against api.uber.com.
 *     The interface stays the same — no UI changes needed.
 */
export function createUberEatsAdapter(): PlatformAdapter {
  // Without server-side OAuth + token caching this can't safely talk to real
  // Uber endpoints from the browser, so we always proxy to the mock for now.
  // The shape below is preserved for when you wire it up server-side.
  const mock = createMockAdapter("UberEats");

  return {
    async connect(input: ConnectInput): Promise<ConnectResult> {
      // Prefer the new credentials map, fall back to legacy fields.
      const c = input.credentials ?? {};
      const clientId = c.client_id || input.clientId;
      const clientSecret = c.client_secret || input.clientSecret;
      const storeId = c.store_uuid || input.storeId;
      // If user provides real OAuth fields, accept them and return a fake token.
      // (Real call: POST https://login.uber.com/oauth/v2/token grant_type=client_credentials)
      if (clientId && clientSecret) {
        return {
          access_token: `uber_real_${clientId.slice(0, 8)}`,
          store_id: storeId || "uber_store_default",
          webhook_secret: clientSecret.slice(0, 16),
        };
      }
      return mock.connect(input);
    },
    async syncMenu(ctx: AdapterContext, items: PlatformMenuItem[]): Promise<SyncResult> {
      // Real call: PUT https://api.uber.com/v1/eats/stores/{store_id}/menus
      return mock.syncMenu(ctx, items);
    },
    async fetchOrders(ctx: AdapterContext, known: PlatformMenuItem[]): Promise<PlatformOrder[]> {
      // Real call: GET https://api.uber.com/v2/eats/orders
      return mock.fetchOrders(ctx, known);
    },
    async setAvailability(ctx: AdapterContext, itemId: string, available: boolean): Promise<void> {
      // Real call: POST .../menu_items/{item_id}/availability
      return mock.setAvailability(ctx, itemId, available);
    },
  };
}