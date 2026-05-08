import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { describeImageFromUrl } from "@/server/ai/lovable-ai.server";

export const Route = createFileRoute("/api/ai/describe-photo")({
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
          if (!supabaseUrl || !supabaseAnon) {
            return Response.json({ error: "Server misconfigured" }, { status: 500 });
          }
          const sb = createClient(supabaseUrl, supabaseAnon);
          const { data: u, error: ue } = await sb.auth.getUser(token);
          if (ue || !u?.user) return Response.json({ error: "Unauthorized" }, { status: 401 });

          const { image_url } = (await request.json()) as { image_url?: string };
          if (!image_url || typeof image_url !== "string") {
            return Response.json({ error: "image_url is required" }, { status: 400 });
          }
          if (image_url.length > 2000) {
            return Response.json({ error: "image_url is too long" }, { status: 400 });
          }

          const dish = await describeImageFromUrl(image_url);
          return Response.json({ dish });
        } catch (e) {
          const err = e as Error & { status?: number };
          console.error("describe-photo error:", err);
          return Response.json(
            { error: err.message || "Unexpected error" },
            { status: err.status ?? 500 },
          );
        }
      },
    },
  },
} as any);