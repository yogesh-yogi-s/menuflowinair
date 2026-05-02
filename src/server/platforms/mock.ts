import type {
  AdapterContext,
  ConnectInput,
  ConnectResult,
  PlatformAdapter,
  PlatformId,
  PlatformMenuItem,
  PlatformOrder,
  SyncResult,
} from "./types";

/** Demo API key required by the mock connect flow. */
export function demoKeyFor(platform: PlatformId): string {
  return `demo-${platform.toLowerCase()}-key`;
}

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function randomCustomer(): string {
  const names = ["Alex Kim", "Priya Patel", "Jordan Lee", "Sam Rivera", "Maya Gupta", "Chris O'Neil"];
  return names[Math.floor(Math.random() * names.length)];
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function createMockAdapter(platform: PlatformId): PlatformAdapter {
  return {
    async connect(input: ConnectInput): Promise<ConnectResult> {
      await delay(400);
      // Real-credentials mode: if the user supplied any non-empty credential
      // values, accept them and skip the demo-key check. We don't actually
      // call the real API here — this is a stub so the UI flows end-to-end.
      const realCreds = input.credentials ?? {};
      const hasReal = Object.values(realCreds).some((v) => v && v.trim().length > 0);
      if (hasReal) {
        return {
          access_token: rid("real_tok"),
          store_id: realCreds.store_id || realCreds.store_uuid || realCreds.restaurant_id || rid("store"),
          webhook_secret: rid("whsec"),
          expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
        };
      }
      const expected = demoKeyFor(platform);
      if (input.apiKey?.trim() !== expected) {
        throw new Error(`Invalid API key for ${platform}. Use "${expected}" for the demo.`);
      }
      return {
        access_token: rid("tok"),
        store_id: rid("store"),
        webhook_secret: rid("whsec"),
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      };
    },

    async syncMenu(_ctx: AdapterContext, items: PlatformMenuItem[]): Promise<SyncResult> {
      await delay(600);
      // ~5% per-item simulated failure
      let failed = 0;
      for (const _ of items) if (Math.random() < 0.05) failed += 1;
      const pushed = items.length - failed;
      if (items.length === 0) {
        return { pushed: 0, failed: 0, message: `No menu items to push to ${platform}` };
      }
      return {
        pushed,
        failed,
        message:
          failed === 0
            ? `Pushed ${pushed} item(s) to ${platform}`
            : `Pushed ${pushed} item(s) to ${platform}, ${failed} failed`,
      };
    },

    async fetchOrders(_ctx: AdapterContext, knownItems: PlatformMenuItem[]): Promise<PlatformOrder[]> {
      await delay(500);
      const count = 3 + Math.floor(Math.random() * 5); // 3–7 orders
      const pool = knownItems.length > 0 ? knownItems : [
        { id: "x", name: "House Special", description: null, price: 12.5, available: true },
      ];
      const orders: PlatformOrder[] = [];
      for (let i = 0; i < count; i++) {
        const numItems = 1 + Math.floor(Math.random() * 3);
        const items: PlatformOrder["items"] = [];
        let total = 0;
        for (let j = 0; j < numItems; j++) {
          const it = pool[Math.floor(Math.random() * pool.length)];
          const qty = 1 + Math.floor(Math.random() * 2);
          const price = Number(it.price);
          total += qty * price;
          items.push({ name: it.name, qty, price });
        }
        orders.push({
          external_order_id: rid("ord"),
          customer_name: randomCustomer(),
          total: Math.round(total * 100) / 100,
          items,
          placed_at: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 6).toISOString(),
        });
      }
      return orders;
    },

    async setAvailability(_ctx: AdapterContext, _itemId: string, _available: boolean): Promise<void> {
      await delay(250);
      // mock — always succeeds
    },

    async updateOrderStatus(
      _ctx: AdapterContext,
      _externalOrderId: string,
      _status: string,
      _reason?: string,
    ): Promise<void> {
      await delay(150);
      // mock — always succeeds
    },
  };
}