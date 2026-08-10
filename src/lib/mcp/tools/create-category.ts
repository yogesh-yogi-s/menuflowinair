import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { dbError, notAuthenticated, ok, supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_category",
  title: "Create menu category",
  description: "Create a new menu category for grouping dishes.",
  inputSchema: {
    name: z.string().trim().min(1).max(80).describe("Category name, e.g. Starters."),
    sort_order: z.number().int().min(0).max(999).optional().describe("Display position."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ name, sort_order }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("categories")
      .insert({ owner_id: ctx.getUserId(), name, sort_order: sort_order ?? 0 })
      .select()
      .single();
    if (error) return dbError(error.message);
    return ok({ category: data });
  },
});