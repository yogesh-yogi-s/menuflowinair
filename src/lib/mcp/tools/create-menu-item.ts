import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { dbError, notAuthenticated, ok, supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_menu_item",
  title: "Create menu item",
  description: "Add a new dish to the signed-in restaurant's menu.",
  inputSchema: {
    name: z.string().trim().min(1).max(120).describe("Dish name."),
    price: z.number().min(0).describe("Price in the restaurant's currency."),
    description: z.string().trim().max(600).optional().describe("Short menu description."),
    category_id: z.string().uuid().optional().describe("Category id from list_categories."),
    available: z.boolean().optional().describe("Whether the dish is currently orderable."),
    image_url: z.string().url().max(2000).optional().describe("Public photo URL for the dish."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("menu_items")
      .insert({
        owner_id: ctx.getUserId(),
        name: input.name,
        price: input.price,
        description: input.description ?? null,
        category_id: input.category_id ?? null,
        available: input.available ?? true,
        image_url: input.image_url ?? null,
      })
      .select()
      .single();
    if (error) return dbError(error.message);
    return ok({ item: data });
  },
});