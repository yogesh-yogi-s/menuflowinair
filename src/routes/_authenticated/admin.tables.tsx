import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Database as DbIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  listTables,
  getColumns,
  getAll,
  createRecord,
  updateRecord,
  deleteRecord,
  type ColumnInfo,
} from "@/services/crud";

export const Route = createFileRoute("/_authenticated/admin/tables")({
  head: () => ({ meta: [{ title: "Admin · Tables" }] }),
  component: AdminTables,
});

const PAGE_SIZE = 20;

function AdminTables() {
  const { isAdmin, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [active, setActive] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const tablesQ = useQuery({
    queryKey: ["admin", "tables"],
    queryFn: listTables,
    enabled: isAdmin,
  });

  const columnsQ = useQuery({
    queryKey: ["admin", "columns", active],
    queryFn: () => getColumns(active!),
    enabled: !!active && isAdmin,
  });

  const rowsQ = useQuery({
    queryKey: ["admin", "rows", active, page, search],
    queryFn: () =>
      getAll(active!, {
        page,
        pageSize: PAGE_SIZE,
        orderBy: hasCreatedAt
          ? { column: "created_at", ascending: false }
          : { column: "id", ascending: false },
      }),
    enabled: !!active && isAdmin && !columnsQ.isLoading,
  });

  const editableCols = useMemo(
    () =>
      (columnsQ.data ?? []).filter(
        (c) => !["id", "created_at", "updated_at"].includes(c.column_name),
      ),
    [columnsQ.data],
  );

  const hasCreatedAt = useMemo(
    () => (columnsQ.data ?? []).some((c) => c.column_name === "created_at"),
    [columnsQ.data],
  );

  const openEdit = (row: Record<string, unknown>) => {
    setEditing(row);
    const f: Record<string, string> = {};
    editableCols.forEach((c) => {
      const v = row[c.column_name];
      f[c.column_name] = v === null || v === undefined ? "" : String(v);
    });
    setForm(f);
  };

  const openCreate = () => {
    setCreating(true);
    const f: Record<string, string> = {};
    editableCols.forEach((c) => (f[c.column_name] = ""));
    setForm(f);
  };

  const close = () => {
    setEditing(null);
    setCreating(false);
  };

  const cast = (col: ColumnInfo, raw: string): unknown => {
    if (raw === "" && col.is_nullable === "YES") return null;
    if (col.data_type.includes("int") || ["numeric", "real", "double precision"].includes(col.data_type))
      return Number(raw);
    if (col.data_type === "boolean") return raw === "true";
    if (col.data_type === "jsonb" || col.data_type === "json") {
      try { return JSON.parse(raw); } catch { return raw; }
    }
    return raw;
  };

  const buildPayload = () => {
    const payload: Record<string, unknown> = {};
    for (const c of editableCols) payload[c.column_name] = cast(c, form[c.column_name] ?? "");
    return payload;
  };

  const createMut = useMutation({
    mutationFn: () => createRecord(active!, buildPayload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "rows", active] });
      toast.success("Row created");
      close();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: () => updateRecord(active!, String(editing!.id), buildPayload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "rows", active] });
      toast.success("Row updated");
      close();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteRecord(active!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "rows", active] });
      toast.success("Row deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (authLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center space-y-3">
            <h2 className="text-xl font-semibold">Admin only</h2>
            <p className="text-sm text-muted-foreground">
              You don't have admin access. Ask an admin to grant you the <code>admin</code> role in the
              <code>user_roles</code> table.
            </p>
            <Button asChild variant="outline"><Link to="/dashboard">Back to dashboard</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rows = (rowsQ.data?.data ?? []) as Record<string, unknown>[];
  const totalCount = rowsQ.data?.count ?? 0;
  const filteredRows = search
    ? rows.filter((r) =>
        Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(search.toLowerCase())),
      )
    : rows;

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="w-64 border-r p-4 space-y-2 overflow-y-auto">
        <div className="flex items-center gap-2 mb-4">
          <DbIcon className="h-5 w-5 text-primary" />
          <h2 className="font-display font-bold">Tables</h2>
        </div>
        {tablesQ.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {tablesQ.error && (
          <div className="text-xs text-destructive">{(tablesQ.error as Error).message}</div>
        )}
        <nav className="space-y-1">
          {(tablesQ.data ?? []).map((t) => (
            <button
              key={t}
              onClick={() => { setActive(t); setPage(0); setSearch(""); }}
              className={`w-full text-left px-3 py-1.5 rounded text-sm hover:bg-accent ${
                active === t ? "bg-accent text-accent-foreground font-medium" : ""
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
        <Button asChild variant="ghost" size="sm" className="w-full mt-4">
          <Link to="/dashboard">← Back to dashboard</Link>
        </Button>
      </aside>

      <main className="flex-1 p-6 space-y-4 overflow-x-auto">
        {!active ? (
          <div className="text-muted-foreground">Select a table on the left.</div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-display font-bold">{active}</h1>
                <p className="text-sm text-muted-foreground">{totalCount} row(s)</p>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Search current page…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-64"
                />
                <Button onClick={openCreate} variant="hero">
                  <Plus className="mr-2 h-4 w-4" /> New row
                </Button>
              </div>
            </div>

            {rowsQ.isLoading ? (
              <div className="text-muted-foreground">Loading rows…</div>
            ) : rowsQ.error ? (
              <div className="text-destructive">{(rowsQ.error as Error).message}</div>
            ) : (
              <div className="rounded-xl border bg-card overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {(columnsQ.data ?? []).map((c) => (
                        <TableHead key={c.column_name}>{c.column_name}</TableHead>
                      ))}
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row) => (
                      <TableRow key={String(row.id ?? Math.random())}>
                        {(columnsQ.data ?? []).map((c) => (
                          <TableCell key={c.column_name} className="max-w-xs truncate">
                            {row[c.column_name] === null || row[c.column_name] === undefined
                              ? <span className="text-muted-foreground italic">null</span>
                              : typeof row[c.column_name] === "object"
                                ? JSON.stringify(row[c.column_name])
                                : String(row[c.column_name])}
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Delete this row?")) deleteMut.mutate(String(row.id));
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
              </span>
              <Button
                variant="outline"
                disabled={(page + 1) * PAGE_SIZE >= totalCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </>
        )}

        <Dialog open={!!editing || creating} onOpenChange={(o) => !o && close()}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit row" : "New row"} — {active}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              {editableCols.map((c) => (
                <div key={c.column_name} className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    {c.column_name} <span className="normal-case">({c.data_type})</span>
                  </Label>
                  <Input
                    value={form[c.column_name] ?? ""}
                    onChange={(e) => setForm({ ...form, [c.column_name]: e.target.value })}
                    placeholder={c.is_nullable === "YES" ? "(nullable)" : ""}
                  />
                </div>
              ))}
              <Button
                className="w-full"
                variant="hero"
                onClick={() => (editing ? updateMut.mutate() : createMut.mutate())}
                disabled={createMut.isPending || updateMut.isPending}
              >
                {(createMut.isPending || updateMut.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}