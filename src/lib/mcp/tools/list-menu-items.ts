import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { dbError, notAuthenticated, ok, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_menu_items",
  title: "List menu items",
  description:
    "List the signed-in restaurant's menu items, optionally filtered by availability or a name search.",
  inputSchema: {
    search: z.string().trim().optional().describe("Case-insensitive match on the item name."),
    available_only: z.boolean().optional().describe("Only return items currently available."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, available_only, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("menu_items")
      .select("id,name,description,price,available,category_id,image_url,created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (search) query = query.ilike("name", `%${search}%`);
    if (available_only) query = query.eq("available", true);
    const { data, error } = await query;
    if (error) return dbError(error.message);
    return ok({ items: data ?? [], count: data?.length ?? 0 });
  },
});