# Integrations — How it works

This app integrates with delivery platforms (Zomato, Swiggy, UberEats, DoorDash, Grubhub) through a small **adapter layer** so the UI is the same whether you're talking to a mock API or the real one.

## 1. Run the migration

Open the **Supabase SQL Editor** and run the contents of `integrations_full_setup.sql`. It:

- Adds `last_sync_status`, `last_sync_message`, `external_store_id` to `integrations`.
- Creates `platform_orders` (orders ingested from platforms).
- Creates `menu_item_availability` (per-platform on/off override per menu item).
- Enables RLS on both, owner-only.

## 2. Connect a platform (demo)

Open **Dashboard → Integrations → Add Integration**, pick a platform, then either click **Use demo key** or paste it manually:

| Platform   | Demo API key          |
| ---------- | --------------------- |
| Zomato     | `demo-zomato-key`     |
| Swiggy     | `demo-swiggy-key`     |
| UberEats   | `demo-ubereats-key`   |
| DoorDash   | `demo-doordash-key`   |
| Grubhub    | `demo-grubhub-key`    |

Click **Connect**. The card flips to ✅ Connected.

## 3. What you can do per integration

- **Sync menu** — pushes your `menu_items` to the platform, writes a `sync_logs` row, updates `last_synced_at`. ~5% per-item failure simulated to test error handling.
- **Fetch orders** — generates 3–7 fake orders derived from your menu and inserts them into `platform_orders`. They show up at **Dashboard → Orders**.
- **Per-platform availability** — on **Menu Management**, the per-platform chips next to each item let you hide a dish on one platform but keep it elsewhere.
- **Toggle (Switch)** — enable/disable the integration globally.
- **Disconnect** — delete the integration row.

## 4. Webhook (real-world style)

Each connected card shows:

```
POST {origin}/api/public/webhook/{platform}?integration={integration_id}
x-webhook-signature: hex(hmac_sha256(webhook_secret, raw_body))
```

Body:
```json
{
  "external_order_id": "ord_abc123",
  "customer_name": "Alex Kim",
  "total": 24.50,
  "items": [{ "name": "Margherita", "qty": 2, "price": 12.25 }],
  "placed_at": "2026-04-30T10:30:00Z"
}
```

Test it with curl (replace `<URL>`, `<SECRET>`, `<JSON>`):

```bash
SECRET=<SECRET>
BODY='{"external_order_id":"ord_test_1","customer_name":"Curl User","total":15.5,"items":[{"name":"Test","qty":1,"price":15.5}]}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $2}')
curl -X POST <URL> \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: $SIG" \
  --data "$BODY"
```

## 5. Going from mock to real

Adapters live in `src/server/platforms/`:

- `mock.ts` — current demo implementation (in-memory, deterministic-ish).
- `ubereats.ts` — real adapter shell. Falls back to mock when no real OAuth creds are passed.
- `index.ts` — `getAdapter(platform)` picks the right one.

To wire up **real UberEats**:

1. Apply at https://developer.uber.com/ for Eats Marketplace API.
2. In **Add Integration → UberEats**, paste real `client_id`, `client_secret`, `store_id`.
3. Implement the real fetches in `src/server/platforms/ubereats.ts` (TODOs marked).

For other platforms when you get partner access:

- **DoorDash**: https://developer.doordash.com/ (Drive API public, Marketplace gated)
- **Zomato / Swiggy / Grubhub**: partner-only, signed agreement required.

Create a new file `src/server/platforms/<name>.ts` that implements `PlatformAdapter`, then add it to `getAdapter()`.

## 6. Storage

Tokens land in `integrations.config` as JSON:

```json
{
  "access_token": "tok_xxx",
  "webhook_secret": "whsec_xxx",
  "expires_at": "..."
}
```

RLS guarantees only the owner can read these. For production with **real** OAuth tokens, encrypt at rest (e.g. via Supabase Vault or column-level pgsodium).