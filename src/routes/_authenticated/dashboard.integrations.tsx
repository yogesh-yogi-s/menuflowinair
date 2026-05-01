import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  RefreshCw,
  Inbox,
  Copy,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  listIntegrations,
  updateIntegration,
  deleteIntegration,
  connectPlatform,
  syncMenuToIntegration,
  fetchOrdersForIntegration,
  listSyncLogs,
  type IntegrationRow,
  type IntegrationConfig,
} from "@/services/integrations";
import { listMenuItems } from "@/services/menu";
import { useAuth } from "@/hooks/use-auth";
import { ALL_PLATFORMS, demoKeyFor, type PlatformId } from "@/server/platforms";
import { CredentialForm, isCredentialFormComplete } from "@/components/integrations/CredentialForm";

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
  const { user } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [picked, setPicked] = useState<PlatformId | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [mode, setMode] = useState<"demo" | "real">("demo");
  const [creds, setCreds] = useState<Record<string, string>>({});

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ["integrations"],
    queryFn: listIntegrations,
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ["menu_items"],
    queryFn: listMenuItems,
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

  const connect = useMutation({
    mutationFn: async () => {
      if (!picked) throw new Error("Pick a platform first");
      if (!user?.id) throw new Error("Not signed in");
      if (mode === "real") {
        if (!isCredentialFormComplete(picked, creds)) {
          throw new Error("Please fill in every required credential field.");
        }
        return connectPlatform(picked, user.id, { apiKey: "", credentials: creds });
      }
      return connectPlatform(picked, user.id, { apiKey });
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["integrations"] });
      toast.success(`${row.platform} connected`);
      setAddOpen(false);
      setPicked(null);
      setApiKey("");
      setCreds({});
      setMode("demo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sync = useMutation({
    mutationFn: (row: IntegrationRow) =>
      syncMenuToIntegration(
        row,
        menuItems.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          price: Number(m.price),
          available: m.available,
        })),
      ),
    onSuccess: (out, row) => {
      qc.invalidateQueries({ queryKey: ["integrations"] });
      qc.invalidateQueries({ queryKey: ["sync_logs", row.id] });
      if (out.failed > 0) toast.warning(out.message);
      else toast.success(out.message);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fetchOrders = useMutation({
    mutationFn: (row: IntegrationRow) =>
      fetchOrdersForIntegration(
        row,
        user!.id,
        menuItems.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          price: Number(m.price),
          available: m.available,
        })),
      ),
    onSuccess: (out, row) => {
      qc.invalidateQueries({ queryKey: ["platform_orders"] });
      toast.success(`${out.inserted} new ${row.platform} order(s) ingested`);
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
  const available = ALL_PLATFORMS.filter((p) => !connectedPlatforms.has(p.id));

  const fillDemo = () => {
    if (picked) setApiKey(demoKeyFor(picked));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Integrations</h1>
          <p className="text-muted-foreground">Manage your delivery platform connections</p>
        </div>
        <Dialog
          open={addOpen}
          onOpenChange={(v) => {
            setAddOpen(v);
            if (!v) setPicked(null);
          }}
        >
          <DialogTrigger asChild>
            <Button variant="hero">
              <Plus className="mr-2 h-4 w-4" /> Add Integration
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{picked ? `Connect ${picked}` : "Add a platform"}</DialogTitle>
              <DialogDescription>
                {picked
                  ? "Enter credentials to authorize the platform."
                  : "Choose a delivery platform to connect to your account."}
              </DialogDescription>
            </DialogHeader>
            {!picked ? (
              <div className="space-y-2 pt-2">
                {available.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  All available platforms are already connected.
                </p>
              ) : (
                available.map((p) => (
                  <button
                    key={p.id}
                      onClick={() => {
                        setPicked(p.id);
                        setApiKey(demoKeyFor(p.id));
                        setMode("demo");
                        setCreds({});
                      }}
                    className="w-full flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent transition-colors text-left disabled:opacity-50"
                  >
                    <div>
                      <div className="font-medium">{p.id}</div>
                      <div className="text-sm text-muted-foreground">{p.description}</div>
                    </div>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))
              )}
            </div>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="flex gap-2 rounded-md border p-1 bg-muted/30 text-sm">
                  <button
                    type="button"
                    onClick={() => setMode("demo")}
                    className={`flex-1 px-3 py-1.5 rounded ${mode === "demo" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
                  >
                    Continue with demo
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("real")}
                    className={`flex-1 px-3 py-1.5 rounded ${mode === "real" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
                  >
                    I have real credentials
                  </button>
                </div>

                {mode === "demo" ? (
                  <div className="space-y-2">
                    <Label>API key</Label>
                    <div className="flex gap-2">
                      <Input
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={demoKeyFor(picked)}
                      />
                      <Button type="button" variant="outline" onClick={fillDemo}>
                        Use demo key
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Demo key: <code className="font-mono">{demoKeyFor(picked)}</code>
                    </p>
                  </div>
                ) : (
                  <CredentialForm platform={picked} values={creds} onChange={setCreds} />
                )}
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => setPicked(null)}>
                    Back
                  </Button>
                  <Button
                    variant="hero"
                    onClick={() => connect.mutate()}
                    disabled={connect.isPending}
                  >
                    {connect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Connect
                  </Button>
                </div>
              </div>
            )}
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
            <IntegrationCard
              key={p.id}
              integration={p}
              onToggle={() => toggle.mutate(p)}
              onSync={() => sync.mutate(p)}
              onFetchOrders={() => fetchOrders.mutate(p)}
              onRemove={() => {
                if (confirm(`Disconnect ${p.platform}?`)) remove.mutate(p.id);
              }}
              syncing={sync.isPending && sync.variables?.id === p.id}
              fetching={fetchOrders.isPending && fetchOrders.variables?.id === p.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CardProps {
  integration: IntegrationRow;
  onToggle: () => void;
  onSync: () => void;
  onFetchOrders: () => void;
  onRemove: () => void;
  syncing: boolean;
  fetching: boolean;
}

function IntegrationCard({
  integration: p,
  onToggle,
  onSync,
  onFetchOrders,
  onRemove,
  syncing,
  fetching,
}: CardProps) {
  const [showSecret, setShowSecret] = useState(false);
  const cfg = (p.config ?? {}) as IntegrationConfig;
  const webhookUrl = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/api/public/webhook/${p.platform.toLowerCase()}?integration=${p.id}`;
  }, [p.id, p.platform]);

  const { data: logs = [] } = useQuery({
    queryKey: ["sync_logs", p.id],
    queryFn: () => listSyncLogs(p.id, 3),
  });

  const copy = (text: string, label: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${label} copied`))
      .catch(() => toast.error("Copy failed"));
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {statusIcon[p.status] ?? statusIcon.disconnected}
            <CardTitle className="text-lg">{p.platform}</CardTitle>
            <Badge variant={statusBadge[p.status] ?? "outline"} className="capitalize">
              {p.status}
            </Badge>
          </div>
          <Switch checked={p.enabled} onCheckedChange={onToggle} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">
          Last synced: {p.last_synced_at ? new Date(p.last_synced_at).toLocaleString() : "never"}
          {p.last_sync_message && (
            <div
              className={
                p.last_sync_status === "error"
                  ? "text-destructive"
                  : p.last_sync_status === "success"
                  ? "text-success"
                  : ""
              }
            >
              {p.last_sync_message}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="hero" onClick={onSync} disabled={syncing || !p.enabled}>
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync menu
          </Button>
          <Button
            size="sm"
            variant="coral"
            onClick={onFetchOrders}
            disabled={fetching || !p.enabled}
          >
            {fetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Inbox className="mr-2 h-4 w-4" />
            )}
            Fetch orders
          </Button>
        </div>

        <div className="rounded-md border bg-muted/30 p-2 space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium">Webhook URL:</span>
            <code className="flex-1 truncate font-mono">{webhookUrl}</code>
            <Button size="icon" variant="ghost" onClick={() => copy(webhookUrl, "URL")}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          {cfg.webhook_secret && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Secret:</span>
              <code className="flex-1 truncate font-mono">
                {showSecret ? cfg.webhook_secret : "•".repeat(16)}
              </code>
              <Button size="icon" variant="ghost" onClick={() => setShowSecret((s) => !s)}>
                {showSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => copy(cfg.webhook_secret!, "Secret")}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {logs.length > 0 && (
          <div className="text-xs space-y-1">
            <div className="font-medium text-muted-foreground">Recent activity</div>
            {logs.map((l) => (
              <div key={l.id} className="flex gap-2">
                <Badge
                  variant={l.status === "error" ? "destructive" : "secondary"}
                  className="text-[10px]"
                >
                  {l.status}
                </Badge>
                <span className="text-muted-foreground truncate">{l.message ?? "—"}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link to="/dashboard/orders">View orders</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 className="mr-1 h-3 w-3" /> Disconnect
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
