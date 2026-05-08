import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Loader2, TrendingUp, ShoppingBag, DollarSign, AlertTriangle } from "lucide-react";
import {
  getKpis,
  getRevenueByPlatform,
  getOrdersTimeseries,
  getTopItems,
  getSyncHealth,
  RANGE_LABEL,
  type RangeKey,
} from "@/services/analytics";
import { useRealtimeTable } from "@/hooks/use-realtime";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({ meta: [{ title: "Overview — MenuFlow" }] }),
  component: DashboardOverview,
});

const PLATFORM_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

function DashboardOverview() {
  const [range, setRange] = useState<RangeKey>("7d");

  // Live: invalidate everything when orders change
  useRealtimeTable({
    table: "platform_orders",
    invalidate: [
      ["analytics", "kpis"],
      ["analytics", "revenue"],
      ["analytics", "timeseries"],
      ["analytics", "top"],
    ],
  });

  const { data: kpis, isLoading: kpiLoading } = useQuery({
    queryKey: ["analytics", "kpis", range],
    queryFn: () => getKpis(range),
  });
  const { data: revenue, isLoading: revLoading } = useQuery({
    queryKey: ["analytics", "revenue", range],
    queryFn: () => getRevenueByPlatform(range),
  });
  const { data: timeseries, isLoading: tsLoading } = useQuery({
    queryKey: ["analytics", "timeseries", range],
    queryFn: () => getOrdersTimeseries(range),
  });
  const { data: topItems, isLoading: topLoading } = useQuery({
    queryKey: ["analytics", "top"],
    queryFn: () => getTopItems(10),
  });
  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ["analytics", "health"],
    queryFn: getSyncHealth,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold">Overview</h1>
          <p className="text-sm text-muted-foreground">{RANGE_LABEL[range]} — updates live as orders come in.</p>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="7d">7d</TabsTrigger>
            <TabsTrigger value="30d">30d</TabsTrigger>
            <TabsTrigger value="90d">90d</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Revenue"
          value={kpis ? `$${kpis.revenue.toFixed(2)}` : "—"}
          delta={kpis?.revenueDelta}
          loading={kpiLoading}
        />
        <KpiCard
          icon={<ShoppingBag className="h-4 w-4" />}
          label="Orders"
          value={kpis ? String(kpis.orders) : "—"}
          delta={kpis?.ordersDelta}
          loading={kpiLoading}
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Avg order value"
          value={kpis ? `$${kpis.aov.toFixed(2)}` : "—"}
          loading={kpiLoading}
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Rejection rate"
          value={kpis ? `${kpis.rejectionRate}%` : "—"}
          loading={kpiLoading}
          tone={kpis && kpis.rejectionRate > 10 ? "warning" : "neutral"}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by platform</CardTitle>
            <CardDescription>Daily revenue, stacked by platform</CardDescription>
          </CardHeader>
          <CardContent>
            {revLoading ? (
              <ChartSkeleton />
            ) : !revenue || revenue.data.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={revenue.data}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
                  {revenue.platforms.map((p, i) => (
                    <Bar
                      key={p}
                      dataKey={p}
                      stackId="a"
                      fill={PLATFORM_COLORS[i % PLATFORM_COLORS.length]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders over time</CardTitle>
            <CardDescription>{range === "today" ? "Hourly today" : "Daily"}</CardDescription>
          </CardHeader>
          <CardContent>
            {tsLoading ? (
              <ChartSkeleton />
            ) : !timeseries || timeseries.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={timeseries}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="bucket"
                    fontSize={11}
                    tickFormatter={(v) =>
                      range === "today"
                        ? new Date(v).getHours() + ":00"
                        : new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                    }
                  />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top items</CardTitle>
            <CardDescription>By order volume (all time)</CardDescription>
          </CardHeader>
          <CardContent>
            {topLoading ? (
              <ChartSkeleton />
            ) : !topItems || topItems.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topItems} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" fontSize={11} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" fontSize={11} width={100} />
                  <Tooltip />
                  <Bar dataKey="qty" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sync health</CardTitle>
            <CardDescription>Connected integrations and recent errors</CardDescription>
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <ChartSkeleton />
            ) : !health || health.length === 0 ? (
              <p className="text-sm text-muted-foreground">No integrations connected yet.</p>
            ) : (
              <div className="space-y-2">
                {health.map((h) => (
                  <Link
                    key={h.id}
                    to="/dashboard/integrations"
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <div className="font-medium text-sm">{h.platform}</div>
                      <div className="text-xs text-muted-foreground">
                        {h.last_synced_at ? new Date(h.last_synced_at).toLocaleString() : "Never synced"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {h.errors_24h > 0 && (
                        <Badge variant="destructive">{h.errors_24h} err / 24h</Badge>
                      )}
                      <Badge variant={h.status === "connected" ? "outline" : "destructive"}>
                        {h.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  delta,
  loading,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: number;
  loading?: boolean;
  tone?: "neutral" | "warning";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-wide">
          <span>{label}</span>
          {icon}
        </div>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin mt-3 text-muted-foreground" />
        ) : (
          <div className="mt-2 flex items-end gap-2">
            <span className={`text-2xl font-bold ${tone === "warning" ? "text-amber-600 dark:text-amber-400" : ""}`}>
              {value}
            </span>
            {delta != null && (
              <span
                className={`text-xs flex items-center ${
                  delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                }`}
              >
                {delta >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {Math.abs(delta)}%
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-[260px] flex items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-[260px] flex flex-col items-center justify-center text-center text-muted-foreground text-sm gap-2">
      <p>No data yet for this range.</p>
      <Link to="/dashboard/integrations" className="text-primary hover:underline">
        Connect a platform & fetch demo orders →
      </Link>
    </div>
  );
}