import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CheckCircle, AlertCircle, Clock, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { listIntegrations, updateIntegration, type IntegrationRow } from "@/services/integrations";

export const Route = createFileRoute("/_authenticated/dashboard/integrations")({
  component: Integrations,
});

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Integrations</h1>
        <p className="text-muted-foreground">Manage your delivery platform connections</p>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : error ? (
        <div className="text-destructive">Failed to load: {(error as Error).message}</div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No integrations yet. Insert a row in the <code>integrations</code> table to add one.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
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
                  <Switch checked={p.enabled} onCheckedChange={() => toggle.mutate(p)} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Last synced: {p.last_synced_at ? new Date(p.last_synced_at).toLocaleString() : "never"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}