import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMenuItems from "./tools/list-menu-items";
import createMenuItem from "./tools/create-menu-item";
import updateMenuItem from "./tools/update-menu-item";
import deleteMenuItem from "./tools/delete-menu-item";
import listCategories from "./tools/list-categories";
import createCategory from "./tools/create-category";
import listOrders from "./tools/list-orders";
import updateOrderStatus from "./tools/update-order-status";
import listIntegrations from "./tools/list-integrations";

// The OAuth issuer must be the direct Supabase host. VITE_SUPABASE_PROJECT_ID is
// inlined at build time; the sentinel only keeps the URL well-formed during the
// throwaway manifest-extract evaluation.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "menu-flow-in-air",
  title: "Menu flow In air",
  version: "0.1.0",
  instructions:
    "Tools for MenuFlow, a restaurant menu and delivery-platform management app. Use list_menu_items and list_categories to read the signed-in restaurant's menu, create/update/delete_menu_item and create_category to change it, list_integrations to inspect connected delivery platforms, and list_orders / update_order_status to work through incoming platform orders. All tools act as the signed-in user and only ever see that user's data.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listMenuItems,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    listCategories,
    createCategory,
    listIntegrations,
    listOrders,
    updateOrderStatus,
  ],
});