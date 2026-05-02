import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Clock, ChevronRight, Inbox } from "lucide-react";
import { toast } from "sonner";
import {
  listPlatformOrders,
  type PlatformOrderRow,
} from "@/services/integrations";
import {
  transitionOrder,
  ORDER_STATUSES,
  NEXT_STATUS,
  isTerminal,
  STATUS_LABEL,
  STATUS_VARIANT,
  ageMinutes,
  ageColor,
  type OrderStatus,
} from "@/services/orders";
import { useRealtimeTable } from "@/hooks/use-realtime";
import { useAuth } from "@/hooks/use-auth";
import { RejectDialog } from "@/components/orders/RejectDialog";
import { useOrderAlerts } from "@/components/orders/OrderAlerts";

export const Route = createFileRoute("/_authenticated/dashboard/orders")({
  head: () => ({ meta: [{ title: "Orders — MenuFlow" }] }),
  component: OrdersPage,
});

const KANBAN_COLUMNS: OrderStatus[] = [
  "received",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
];

function OrdersPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const announce = useOrderAlerts();

  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [view, setView] = useState<"table" | "kanban">("table");
  const [rejectFor, setRejectFor] = useState<{
    order: PlatformOrderRow;
    action: "reject" | "cancel";
  } | null>(null);

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ["platform_orders"],
    queryFn: listPlatformOrders,
  });

  // Live updates + new order alerts
  useRealtimeTable<PlatformOrderRow>({
    table: "platform_orders",
    invalidate: [["platform_orders"]],
    onInsert: (row) => {
      if (row.status === "received") {
        announce({
          customer: row.customer_name ?? "Guest",
          total: Number(row.total),
          platform: row.platform,
        });
      }
    },
  });

  const transition = useMutation({
    mutationFn: (args: {
      orderId: string;
      fromStatus: string;
      toStatus: OrderStatus;
      reason?: string;
    }) =>
      transitionOrder({
        orderId: args.orderId,
        ownerId: user!.id,
        fromStatus: args.fromStatus,
        toStatus: args.toStatus,
        reason: args.reason,
      }),
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ["platform_orders"] });
      toast.success(`Order moved to ${STATUS_LABEL[vars.toStatus]}`);
      if (res.adapterError) {
        toast.warning(`Local update saved, platform push failed: ${res.adapterError}`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const platforms = useMemo(
    () => Array.from(new Set(orders.map((o) => o.platform))),
    [orders],
  );

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (platformFilter !== "all" && o.platform !== platformFilter) return false;
      if (statusFilter === "all") return true;
      if (statusFilter === "active") return !isTerminal(o.status);
      return o.status === statusFilter;
    });
  }, [orders, platformFilter, statusFilter]);

  const handleAdvance = (o: PlatformOrderRow, next: OrderStatus) => {
    if (next === "rejected" || next === "cancelled") {
      setRejectFor({ order: o, action: next === "rejected" ? "reject" : "cancel" });
      return;
    }
    transition.mutate({ orderId: o.id, fromStatus: o.status, toStatus: next });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold">Orders</h1>
          <p className="text-muted-foreground text-sm">
            Live orders from connected platforms. New orders alert you with a sound + notification.
          </p>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as "table" | "kanban")}>
          <TabsList>
            <TabsTrigger value="table">Table</TabsTrigger>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {platforms.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="rounded-xl border bg-card p-12 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-xl border bg-card p-12 text-center text-destructive">
          {(error as Error).message}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
          <Inbox className="h-8 w-8 mx-auto mb-3 opacity-60" />
          No orders match these filters. Open Integrations → Fetch orders to ingest demo orders.
        </div>
      ) : view === "table" ? (
        <OrderTable orders={filtered} onAdvance={handleAdvance} pending={transition.isPending} />
      ) : (
        <OrderKanban orders={filtered} onAdvance={handleAdvance} pending={transition.isPending} />
      )}

      {rejectFor && (
        <RejectDialog
          open
          action={rejectFor.action}
          onOpenChange={(o) => !o && setRejectFor(null)}
          loading={transition.isPending}
          onConfirm={(reason) => {
            transition.mutate(
              {
                orderId: rejectFor.order.id,
                fromStatus: rejectFor.order.status,
                toStatus: rejectFor.action === "reject" ? "rejected" : "cancelled",
                reason,
              },
              { onSettled: () => setRejectFor(null) },
            );
          }}
        />
      )}
    </div>
  );
}

function OrderTable({
  orders,
  onAdvance,
  pending,
}: {
  orders: PlatformOrderRow[];
  onAdvance: (o: PlatformOrderRow, next: OrderStatus) => void;
  pending: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Placed</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Items</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => {
            const items = Array.isArray(o.items) ? (o.items as Array<{ name: string; qty: number }>) : [];
            const age = ageMinutes(o.placed_at);
            const next = NEXT_STATUS[o.status as OrderStatus] ?? [];
            const primary = next[0];
            const danger = next.find((n) => n === "rejected" || n === "cancelled");
            return (
              <TableRow key={o.id}>
                <TableCell>
                  <div className="text-xs">{new Date(o.placed_at).toLocaleString()}</div>
                  <div className={`text-xs flex items-center gap-1 ${ageColor(age)}`}>
                    <Clock className="h-3 w-3" /> {age != null ? `${age}m ago` : "—"}
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline">{o.platform}</Badge></TableCell>
                <TableCell>{o.customer_name ?? "—"}</TableCell>
                <TableCell className="text-sm">
                  {items.map((it, i) => (
                    <div key={i}>{it.qty}× {it.name}</div>
                  ))}
                </TableCell>
                <TableCell className="text-right font-medium">${Number(o.total).toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[o.status] ?? "outline"}>
                    {STATUS_LABEL[o.status as OrderStatus] ?? o.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {primary && (
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() => onAdvance(o, primary)}
                      >
                        {STATUS_LABEL[primary]}
                        <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    )}
                    {danger && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={pending}
                        onClick={() => onAdvance(o, danger)}
                      >
                        {danger === "rejected" ? "Reject" : "Cancel"}
                      </Button>
                    )}
                    {next.length === 0 && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function OrderKanban({
  orders,
  onAdvance,
  pending,
}: {
  orders: PlatformOrderRow[];
  onAdvance: (o: PlatformOrderRow, next: OrderStatus) => void;
  pending: boolean;
}) {
  const grouped = KANBAN_COLUMNS.map((status) => ({
    status,
    items: orders.filter((o) => o.status === status),
  }));

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
      {grouped.map((col) => (
        <div key={col.status} className="rounded-xl border bg-card flex flex-col min-h-[200px]">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <span className="text-sm font-medium">{STATUS_LABEL[col.status]}</span>
            <Badge variant="secondary">{col.items.length}</Badge>
          </div>
          <div className="p-2 space-y-2 flex-1">
            {col.items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No orders</p>
            ) : (
              col.items.map((o) => {
                const next = NEXT_STATUS[o.status as OrderStatus]?.[0];
                const age = ageMinutes(o.placed_at);
                return (
                  <div key={o.id} className="rounded-md border bg-background p-2 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{o.customer_name ?? "Guest"}</span>
                      <span className={ageColor(age)}>{age}m</span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{o.platform}</Badge>
                    <div className="font-medium">${Number(o.total).toFixed(2)}</div>
                    {next && (
                      <Button
                        size="sm"
                        className="w-full h-7 text-xs"
                        disabled={pending}
                        onClick={() => onAdvance(o, next)}
                      >
                        → {STATUS_LABEL[next]}
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}