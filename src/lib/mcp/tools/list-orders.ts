import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { dbError, notAuthenticated, ok, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_orders",
  title: "List platform orders",
  description:
    "List recent delivery-platform orders (Zomato, Swiggy, Uber Eats, ...) for the signed-in restaurant.",
  inputSchema: {
    status: z
      .string()
      .trim()
      .optional()
      .describe("Filter by order status, e.g. pending, accepted, ready, completed, rejected."),
    platform: z.string().trim().optional().describe("Filter by platform name."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows to return (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, platform, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("platform_orders")
      .select("id,platform,external_order_id,status,customer_name,total,items,placed_at")
      .order("placed_at", { ascending: false })
      .limit(limit ?? 25);
    if (status) query = query.eq("status", status);
    if (platform) query = query.eq("platform", platform);
    const { data, error } = await query;
    if (error) return dbError(error.message);
    return ok({ orders: data ?? [], count: data?.length ?? 0 });
  },
});