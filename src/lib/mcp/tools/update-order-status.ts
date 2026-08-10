import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { dbError, notAuthenticated, ok, supabaseForUser } from "../supabase";

const STATUSES = ["accepted", "preparing", "ready", "completed", "rejected"] as const;

export default defineTool({
  name: "update_order_status",
  title: "Update order status",
  description:
    "Move a platform order through its lifecycle: accepted, preparing, ready, completed, or rejected.",
  inputSchema: {
    id: z.string().uuid().describe("Order id from list_orders."),
    status: z.enum(STATUSES).describe("New order status."),
    reason: z.string().trim().max(300).optional().describe("Reason, required when rejecting."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ id, status, reason }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    if (status === "rejected" && !reason) {
      return dbError("A reason is required when rejecting an order.");
    }
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status };
    if (reason) patch.status_reason = reason;
    if (status === "accepted") patch.accepted_at = now;
    if (status === "ready") patch.ready_at = now;
    if (status === "completed") patch.completed_at = now;

    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("platform_orders")
      .update(patch)
      .eq("id", id)
      .select("id,platform,external_order_id,status,status_reason")
      .maybeSingle();
    if (error) return dbError(error.message);
    if (!data) return dbError("Order not found.");
    return ok({ order: data });
  },
});