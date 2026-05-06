import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { generateAndStoreSummary } from "@/server/ai/summary.server";

/** On-demand: lets the signed-in user generate yesterday's summary right now. */
export const Route = createFileRoute("/api/ai/generate-summary-now")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const authHeader = request.headers.get("authorization") ?? "";
          const token = authHeader.toLowerCase().startsWith("bearer ")
            ? authHeader.slice(7).trim()
            : "";
          if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

          const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
          const supabaseAnon =
            process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (!supabaseUrl || !supabaseAnon || !supabaseService) {
            return Response.json({ error: "Server misconfigured" }, { status: 500 });
          }
          const sbAuth = createClient(supabaseUrl, supabaseAnon);
          const { data: u, error: ue } = await sbAuth.auth.getUser(token);
          if (ue || !u?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

          const sb = createClient(supabaseUrl, supabaseService);
          const { data: prof } = await sb
            .from("profiles")
            .select("timezone")
            .eq("id", u.user.id)
            .maybeSingle();
          const tz = prof?.timezone || "UTC";

          const { localDateISO } = await import("../../../server/ai/summary.server");
          // previous day in local tz
          const today = localDateISO(tz);
          const d = new Date(`${today}T00:00:00Z`);
          d.setUTCDate(d.getUTCDate() - 1);
          const summary_date = d.toISOString().slice(0, 10);
          await sb
            .from("daily_summaries")
            .delete()
            .eq("owner_id", u.user.id)
            .eq("summary_date", summary_date);

          const result = await generateAndStoreSummary(u.user.id, tz);
          return Response.json(result);
        } catch (e) {
          console.error("generate-summary-now error:", e);
          return Response.json(
            { error: (e as Error).message || "Unexpected error" },
            { status: 500 },
          );
        }
      },
    },
  },
} as any);