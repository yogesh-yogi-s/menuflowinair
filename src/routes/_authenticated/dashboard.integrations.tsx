import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  AlertCircle,
  Clock,
  PowerOff,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  listIntegrations,
  updateIntegration,
  createIntegration,
  deleteIntegration,
  type IntegrationRow,
} from "@/services/integrations";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/dashboard/integrations")({
  component: Integrations,
});

const AVAILABLE_PLATFORMS = [
  { id: "Zomato", description: "Indian food delivery & discovery" },
  { id: "Swiggy", description: "On-demand delivery in India" },
  { id: "UberEats", description: "Global food delivery" },
  { id: "DoorDash", description: "US food delivery network" },
  { id: "Grubhub", description: "US online ordering & delivery" },
];

const statusIcon = {
  connected: <CheckCircle className="h-5 w-5 text-success" />,
  syncing: <Clock className="h-5 w-5 text-warning animate-spin" />,
  error: <AlertCircle className="h-5 w-5 text-destructive" />,
  disconnected: <PowerOff className="h-5 w-5 text-muted-foreground" />,
};

const statusBadge: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  connected: "default",
  syncing: "secondary",
  error: "destructive",
  disconnected: "outline",
};

function Integrations() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [addOpen, setAddOpen] = useState(false);

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ["integrations"],
    queryFn: listIntegrations,
  });

  const toggle = useMutation({
    mutationFn: (p: IntegrationRow) =>
      updateIntegration(p.id, {
        enabled: !p.enabled,
        status: !p.enabled ? "connected" : "disconnected",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: (platform: string) =>
      createIntegration({
        platform,
        status: "connected",
        enabled: true,
        owner_id: user?.id,
      }),
    onSuccess: (_d, platform) => {
      qc.invalidateQueries({ queryKey: ["integrations"] });
      toast.success(`${platform} connected`);
      setAddOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteIntegration(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["integrations"] });
      toast.success("Integration disconnected");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const connectedPlatforms = new Set(items.map((i) => i.platform));
  const available = AVAILABLE_PLATFORMS.filter((p) => !connectedPlatforms.has(p.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Integrations</h1>
          <p className="text-muted-foreground">Manage your delivery platform connections</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button variant="hero">
              <Plus className="mr-2 h-4 w-4" /> Add Integration
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a platform</DialogTitle>
              <DialogDescription>
                Choose a delivery platform to connect to your account.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 pt-2">
              {available.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  All available platforms are already connected.
                </p>
              ) : (
                available.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => create.mutate(p.id)}
                    disabled={create.isPending}
                    className="w-full flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent transition-colors text-left disabled:opacity-50"
                  >
                    <div>
                      <div className="font-medium">{p.id}</div>
                      <div className="text-sm text-muted-foreground">{p.description}</div>
                    </div>
                    {create.isPending && create.variables === p.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : error ? (
        <div className="text-destructive">Failed to load: {(error as Error).message}</div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No integrations yet. Click "Add Integration" to connect your first platform.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((p) => (
            <Card key={p.id} className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {statusIcon[p.status] ?? statusIcon.disconnected}
                    <CardTitle className="text-lg">{p.platform}</CardTitle>
                    <Badge variant={statusBadge[p.status] ?? "outline"} className="capitalize">
                      {p.status}
                    </Badge>
                  </div>
                  <Switch
                    checked={p.enabled}
                    onCheckedChange={() => toggle.mutate(p)}
                    disabled={toggle.isPending}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Last synced:{" "}
                  {p.last_synced_at ? new Date(p.last_synced_at).toLocaleString() : "never"}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    if (confirm(`Disconnect ${p.platform}?`)) remove.mutate(p.id);
                  }}
                  disabled={remove.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Disconnect
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
