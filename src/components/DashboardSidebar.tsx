import { Utensils, LayoutDashboard, Link2, Sparkles, LogOut, Shield, User, Inbox, BarChart3 } from "lucide-react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { listPlatformOrders } from "@/services/integrations";
import { useRealtimeTable } from "@/hooks/use-realtime";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Overview", url: "/dashboard" as const, icon: BarChart3 },
  { title: "Menu", url: "/dashboard/menu" as const, icon: LayoutDashboard },
  { title: "Integrations", url: "/dashboard/integrations" as const, icon: Link2 },
  { title: "Orders", url: "/dashboard/orders" as const, icon: Inbox },
  { title: "AI Tools", url: "/dashboard/ai-tools" as const, icon: Sparkles },
  { title: "Profile", url: "/dashboard/profile" as const, icon: User },
];

function getInitials(name?: string | null, email?: string | null): string {
  const source = (name && name.trim()) || (email && email.split("@")[0]) || "U";
  const parts = source.trim().split(/\s+/);
  const letters = parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`
    : source.slice(0, 2);
  return letters.toUpperCase();
}

export function DashboardSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isAdmin, user, profile } = useAuth();
  const isActive = (path: string) => location.pathname === path;

  const { data: orders = [] } = useQuery({
    queryKey: ["platform_orders"],
    queryFn: listPlatformOrders,
    enabled: !!user,
  });
  useRealtimeTable({
    table: "platform_orders",
    invalidate: [["platform_orders"]],
    enabled: !!user,
  });
  const newOrders = orders.filter((o) => o.status === "received").length;

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const avatarUrl = profile?.avatar_url ?? undefined;
  const displayName = profile?.full_name ?? undefined;
  const initials = getInitials(displayName, user?.email);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-4 flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg gradient-hero flex items-center justify-center flex-shrink-0">
            <Utensils className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && <span className="text-lg font-display font-bold">MenuFlow</span>}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link
                      to={item.url}
                      className="hover:bg-muted/50"
                      activeProps={{ className: "bg-accent text-accent-foreground font-medium" }}
                      activeOptions={{ exact: true }}
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && (
                        <span className="flex-1 flex items-center justify-between">
                          <span>{item.title}</span>
                          {item.url === "/dashboard/orders" && newOrders > 0 && (
                            <Badge variant="destructive" className="h-5 min-w-5 px-1.5">
                              {newOrders}
                            </Badge>
                          )}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname.startsWith("/admin")}>
                    <Link to="/admin/tables" className="hover:bg-muted/50">
                      <Shield className="mr-2 h-4 w-4" />
                      {!collapsed && <span>Admin Tables</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-4 space-y-2">
          {user && (
            <Link
              to="/dashboard/profile"
              className="flex flex-col items-center gap-2 rounded-md p-2 hover:bg-muted/50 transition-colors"
              title={displayName || user.email || "Profile"}
            >
              <Avatar className={collapsed ? "h-8 w-8" : "h-14 w-14"}>
                {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName || user.email || "Avatar"} />}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="text-center w-full">
                  {displayName && (
                    <div className="text-sm font-medium truncate">{displayName}</div>
                  )}
                  <div className="text-xs text-muted-foreground truncate" title={user.email ?? ""}>
                    {user.email}
                  </div>
                </div>
              )}
            </Link>
          )}
          <ThemeToggle />
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            {!collapsed && <span>Sign out</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
