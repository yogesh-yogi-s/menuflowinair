import { Utensils, LayoutDashboard, Link2, Sparkles, LogOut } from "lucide-react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
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
  { title: "Menu Management", url: "/dashboard" as const, icon: LayoutDashboard },
  { title: "Integrations", url: "/dashboard/integrations" as const, icon: Link2 },
  { title: "AI Tools", url: "/dashboard/ai-tools" as const, icon: Sparkles },
];

export function DashboardSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = () => {
    navigate({ to: "/login" });
  };

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
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-4 space-y-2">
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