import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { translateBatch } from "@/server/ai/gemini.server";

export const Route = createFileRoute("/api/ai/translate-menu")({
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
          const userId = u.user.id;

          const { locale, only_missing } = (await request.json()) as {
            locale?: string;
            only_missing?: boolean;
          };
          if (!locale || typeof locale !== "string" || locale.length > 10) {
            return Response.json({ error: "locale is required" }, { status: 400 });
          }

          // Use service role for batch read/write within owner scope.
          const sb = createClient(supabaseUrl, supabaseService);

          const [{ data: items, error: ie }, { data: cats, error: ce }] =
            await Promise.all([
              sb
                .from("menu_items")
                .select("id,name,description")
                .eq("owner_id", userId),
              sb
                .from("categories")
                .select("id,name")
                .eq("owner_id", userId),
            ]);
          if (ie || ce) {
            return Response.json(
              { error: ie?.message || ce?.message || "Failed to load menu" },
              { status: 500 },
            );
          }

          let toTranslateItems = items ?? [];
          let toTranslateCats = cats ?? [];
          if (only_missing) {
            const { data: existingItems } = await sb
              .from("menu_item_translations")
              .select("menu_item_id")
              .eq("locale", locale)
              .eq("owner_id", userId);
            const { data: existingCats } = await sb
              .from("category_translations")
              .select("category_id")
              .eq("locale", locale)
              .eq("owner_id", userId);
            const haveItems = new Set((existingItems ?? []).map((r) => r.menu_item_id));
            const haveCats = new Set((existingCats ?? []).map((r) => r.category_id));
            toTranslateItems = toTranslateItems.filter((i) => !haveItems.has(i.id));
            toTranslateCats = toTranslateCats.filter((c) => !haveCats.has(c.id));
          }

          if (toTranslateItems.length === 0 && toTranslateCats.length === 0) {
            return Response.json({ items_inserted: 0, categories_inserted: 0 });
          }

          const result = await translateBatch(
            locale,
            toTranslateItems,
            toTranslateCats,
          );

          // Upsert translations.
          const itemRows = result.items.map((t) => ({
            menu_item_id: t.id,
            owner_id: userId,
            locale,
            name: t.name,
            description: t.description || null,
            ai_generated: true,
          }));
          const catRows = result.categories.map((t) => ({
            category_id: t.id,
            owner_id: userId,
            locale,
            name: t.name,
            ai_generated: true,
          }));

          if (itemRows.length > 0) {
            const { error } = await sb
              .from("menu_item_translations")
              .upsert(itemRows, { onConflict: "menu_item_id,locale" });
            if (error) throw error;
          }
          if (catRows.length > 0) {
            const { error } = await sb
              .from("category_translations")
              .upsert(catRows, { onConflict: "category_id,locale" });
            if (error) throw error;
          }

          return Response.json({
            items_inserted: itemRows.length,
            categories_inserted: catRows.length,
          });
        } catch (e) {
          const err = e as Error & { status?: number };
          console.error("translate-menu error:", err);
          return Response.json(
            { error: err.message || "Unexpected error" },
            { status: err.status ?? 500 },
          );
        }
      },
    },
  },
} as any);