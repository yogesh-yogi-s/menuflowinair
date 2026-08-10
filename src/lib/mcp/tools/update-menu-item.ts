import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { dbError, notAuthenticated, ok, supabaseForUser } from "../supabase";

export default defineTool({
  name: "update_menu_item",
  title: "Update menu item",
  description:
    "Update fields on an existing menu item, such as its price, description, category, or availability.",
  inputSchema: {
    id: z.string().uuid().describe("Menu item id from list_menu_items."),
    name: z.string().trim().min(1).max(120).optional(),
    price: z.number().min(0).optional(),
    description: z.string().trim().max(600).optional(),
    category_id: z.string().uuid().nullable().optional(),
    available: z.boolean().optional(),
    image_url: z.string().url().max(2000).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ id, ...patch }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const fields = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(fields).length === 0) return dbError("No fields to update.");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("menu_items")
      .update(fields)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) return dbError(error.message);
    if (!data) return dbError("Menu item not found.");
    return ok({ item: data });
  },
});