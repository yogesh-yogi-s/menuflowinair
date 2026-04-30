import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

/**
 * Public webhook receiver. External platforms POST new orders here.
 *
 * URL pattern:
 *   POST /api/public/webhook/{platform}?integration={integration_id}
 *
 * Headers:
 *   x-webhook-signature: hex(hmac_sha256(webhook_secret, raw_body))
 *
 * Body (JSON):
 *   {
 *     external_order_id: string,
 *     customer_name?: string,
 *     total: number,
 *     items: [{ name, qty, price }],
 *     placed_at?: string  // ISO
 *   }
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-webhook-signature",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

export const Route = createFileRoute("/api/public/webhook/$platform")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request, params }) => {
        try {
          const url = new URL(request.url);
          const integrationId = url.searchParams.get("integration");
          if (!integrationId) {
            return json({ error: "Missing ?integration=<id>" }, 400);
          }

          const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
          const supabaseKey =
            process.env.SUPABASE_SERVICE_ROLE_KEY ??
            process.env.SUPABASE_PUBLISHABLE_KEY ??
            process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          if (!supabaseUrl || !supabaseKey) {
            console.error("webhook: Supabase env not configured");
            return json({ error: "Server misconfigured" }, 500);
          }
          const sb = createClient(supabaseUrl, supabaseKey);

          const { data: integration, error: intErr } = await sb
            .from("integrations")
            .select("*")
            .eq("id", integrationId)
            .maybeSingle();
          if (intErr || !integration) {
            return json({ error: "Integration not found" }, 404);
          }

          const expectedPlatform = String(integration.platform).toLowerCase();
          if (expectedPlatform !== params.platform.toLowerCase()) {
            return json({ error: "Platform mismatch" }, 400);
          }

          const cfg = (integration.config ?? {}) as { webhook_secret?: string };
          const secret = cfg.webhook_secret;
          if (!secret) return json({ error: "No webhook secret on this integration" }, 400);

          const rawBody = await request.text();
          const signature = request.headers.get("x-webhook-signature") || "";
          const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
          const sigOk =
            signature.length === expected.length &&
            crypto.timingSafeEqual(
              Buffer.from(signature, "utf8"),
              Buffer.from(expected, "utf8"),
            );
          if (!sigOk) return json({ error: "Invalid signature" }, 401);

          let payload: {
            external_order_id?: string;
            customer_name?: string;
            total?: number;
            items?: Array<{ name: string; qty: number; price: number }>;
            placed_at?: string;
          };
          try {
            payload = JSON.parse(rawBody);
          } catch {
            return json({ error: "Invalid JSON" }, 400);
          }

          if (!payload.external_order_id || typeof payload.total !== "number") {
            return json({ error: "external_order_id and numeric total are required" }, 400);
          }

          const { error: insErr } = await sb.from("platform_orders").upsert(
            {
              owner_id: integration.owner_id,
              integration_id: integration.id,
              platform: integration.platform,
              external_order_id: payload.external_order_id,
              status: "received",
              customer_name: payload.customer_name ?? null,
              total: payload.total,
              items: payload.items ?? [],
              placed_at: payload.placed_at ?? new Date().toISOString(),
            },
            { onConflict: "integration_id,external_order_id", ignoreDuplicates: true },
          );
          if (insErr) {
            console.error("webhook insert error:", insErr);
            return json({ error: "DB insert failed" }, 500);
          }

          return json({ ok: true });
        } catch (e) {
          console.error("webhook error:", e);
          return json({ error: "Unexpected error" }, 500);
        }
      },
    },
  },
});