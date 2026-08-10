import { defineTool } from "@lovable.dev/mcp-js";
import { dbError, notAuthenticated, ok, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_categories",
  title: "List menu categories",
  description:
    "List the signed-in restaurant's menu categories (Starters, Mains, Desserts, ...) with their ids.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("categories")
      .select("id,name,sort_order")
      .order("sort_order", { ascending: true });
    if (error) return dbError(error.message);
    return ok({ categories: data ?? [] });
  },
});