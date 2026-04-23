import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CheckCircle, AlertCircle, Clock } from "lucide-react";

export const Route = createFileRoute("/dashboard/integrations")({
  component: Integrations,
});

interface Platform {
  id: string;
  name: string;
  status: "connected" | "syncing" | "error";
  lastSync: string;
  enabled: boolean;
}

const initialPlatforms: Platform[] = [
  { id: "1", name: "DoorDash", status: "connected", lastSync: "2 min ago", enabled: true },
  { id: "2", name: "UberEats", status: "connected", lastSync: "5 min ago", enabled: true },
  { id: "3", name: "Grubhub", status: "error", lastSync: "1 hour ago", enabled: false },
];

const statusIcon = {
  connected: <CheckCircle className="h-5 w-5 text-success" />,
  syncing: <Clock className="h-5 w-5 text-warning animate-spin" />,
  error: <AlertCircle className="h-5 w-5 text-destructive" />,
};

const statusBadge = {
  connected: "default" as const,
  syncing: "secondary" as const,
  error: "destructive" as const,
};

function Integrations() {
  const [platforms, setPlatforms] = useState<Platform[]>(initialPlatforms);

  const toggle = (id: string) =>
    setPlatforms((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, enabled: !p.enabled, status: !p.enabled ? "connected" : "error" } : p
      )
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Integrations</h1>
        <p className="text-muted-foreground">Manage your delivery platform connections</p>
      </div>

      <div className="grid gap-4">
        {platforms.map((p) => (
          <Card key={p.id} className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {statusIcon[p.status]}
                  <CardTitle className="text-lg">{p.name}</CardTitle>
                  <Badge variant={statusBadge[p.status]} className="capitalize">{p.status}</Badge>
                </div>
                <Switch checked={p.enabled} onCheckedChange={() => toggle(p.id)} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Last synced: {p.lastSync}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}