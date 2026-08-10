import { defineTool } from "@lovable.dev/mcp-js";
import { dbError, notAuthenticated, ok, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_integrations",
  title: "List delivery integrations",
  description:
    "List the signed-in restaurant's delivery-platform integrations with their connection and sync status.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("integrations")
      .select(
        "id,platform,status,enabled,last_synced_at,last_sync_status,last_sync_message,external_store_id",
      )
      .order("platform", { ascending: true });
    if (error) return dbError(error.message);
    return ok({ integrations: data ?? [] });
  },
});