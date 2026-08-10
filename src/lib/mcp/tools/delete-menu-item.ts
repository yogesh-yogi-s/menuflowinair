import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { dbError, notAuthenticated, ok, supabaseForUser } from "../supabase";

export default defineTool({
  name: "delete_menu_item",
  title: "Delete menu item",
  description: "Permanently remove a menu item from the signed-in restaurant's menu.",
  inputSchema: {
    id: z.string().uuid().describe("Menu item id from list_menu_items."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", id)
      .select("id,name")
      .maybeSingle();
    if (error) return dbError(error.message);
    if (!data) return dbError("Menu item not found.");
    return ok({ deleted: data });
  },
});