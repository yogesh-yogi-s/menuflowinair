import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  generateAndStoreSummary,
  localHour,
} from "@/server/ai/summary.server";

const TARGET_HOUR = 8;

export const Route = createFileRoute("/api/public/cron/daily-summary")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const secret = request.headers.get("x-cron-secret");
          const expected = process.env.CRON_SECRET;
          if (!expected || secret !== expected) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }

          const url = process.env.SUPABASE_URL;
          const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (!url || !key) {
            return Response.json({ error: "Server misconfigured" }, { status: 500 });
          }
          const sb = createClient(url, key, { auth: { persistSession: false } });

          const { data: profiles, error } = await sb
            .from("profiles")
            .select("id,timezone");
          if (error) {
            return Response.json({ error: error.message }, { status: 500 });
          }

          const results: Array<{ owner_id: string; status: string }> = [];
          for (const p of profiles ?? []) {
            const tz = p.timezone || "UTC";
            if (localHour(tz) !== TARGET_HOUR) continue;
            try {
              const r = await generateAndStoreSummary(p.id, tz);
              results.push({
                owner_id: p.id,
                status: r.created ? "created" : "exists",
              });
            } catch (e) {
              console.error("summary failed for", p.id, e);
              results.push({ owner_id: p.id, status: "error" });
            }
          }

          return Response.json({ processed: results.length, results });
        } catch (e) {
          console.error("daily-summary cron error:", e);
          return Response.json(
            { error: (e as Error).message || "Unexpected error" },
            { status: 500 },
          );
        }
      },
    },
  },
} as any);