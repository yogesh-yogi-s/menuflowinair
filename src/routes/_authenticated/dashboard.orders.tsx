import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  listPlatformOrders,
  updateOrderStatus,
  type PlatformOrderRow,
} from "@/services/integrations";

export const Route = createFileRoute("/_authenticated/dashboard/orders")({
  component: OrdersPage,
});

const STATUSES = ["received", "preparing", "ready", "delivered", "cancelled"] as const;

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  received: "secondary",
  preparing: "default",
  ready: "default",
  delivered: "outline",
  cancelled: "destructive",
};

function OrdersPage() {
  const qc = useQueryClient();
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ["platform_orders"],
    queryFn: listPlatformOrders,
  });

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateOrderStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform_orders"] });
      toast.success("Order updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const platforms = Array.from(new Set(orders.map((o) => o.platform)));
  const filtered = orders.filter(
    (o) =>
      (platformFilter === "all" || o.platform === platformFilter) &&
      (statusFilter === "all" || o.status === statusFilter),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Orders</h1>
        <p className="text-muted-foreground">
          Orders ingested from connected platforms (synced or via webhook).
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {platforms.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="p-8 text-center text-destructive">{(error as Error).message}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No orders yet. Open Integrations → Fetch orders to ingest demo orders.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Placed</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o: PlatformOrderRow) => {
                const items = Array.isArray(o.items) ? (o.items as Array<{ name: string; qty: number }>) : [];
                return (
                  <TableRow key={o.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(o.placed_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{o.platform}</Badge>
                    </TableCell>
                    <TableCell>{o.customer_name ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {items.map((it, i) => (
                        <div key={i}>
                          {it.qty}× {it.name}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${Number(o.total).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={o.status}
                        onValueChange={(v) => update.mutate({ id: o.id, status: v })}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue>
                            <Badge variant={statusVariant[o.status] ?? "outline"}>{o.status}</Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}