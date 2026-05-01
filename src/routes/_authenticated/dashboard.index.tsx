import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  listMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  listCategories,
  type MenuItemRow,
} from "@/services/menu";
import {
  logSync,
  listIntegrations,
  listAvailabilityOverrides,
  setItemPlatformAvailability,
} from "@/services/integrations";
import { useAuth } from "@/hooks/use-auth";
import { CategoryManager } from "@/components/menu/CategoryManager";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: MenuManagement,
});

interface FormState {
  id?: string;
  name: string;
  description: string;
  price: number;
  category_id: string;
  available: boolean;
}

const emptyForm: FormState = { name: "", description: "", price: 0, category_id: "", available: true };

function MenuManagement() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<MenuItemRow | null>(null);
  const [syncing, setSyncing] = useState(false);

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ["menu_items"],
    queryFn: listMenuItems,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
  });

  const { data: integrations = [] } = useQuery({
    queryKey: ["integrations"],
    queryFn: listIntegrations,
  });

  const { data: overrides = [] } = useQuery({
    queryKey: ["availability_overrides"],
    queryFn: listAvailabilityOverrides,
  });

  const isOverrideOn = (menuItemId: string, integrationId: string): boolean => {
    const row = overrides.find(
      (o) => o.menu_item_id === menuItemId && o.integration_id === integrationId,
    );
    return row ? row.available : true;
  };

  const toggleOverride = useMutation({
    mutationFn: ({
      menuItemId,
      integrationId,
      available,
    }: {
      menuItemId: string;
      integrationId: string;
      available: boolean;
    }) => {
      const integ = integrations.find((i) => i.id === integrationId);
      if (!integ) throw new Error("Integration not found");
      if (!user?.id) throw new Error("Not signed in");
      return setItemPlatformAvailability(user.id, menuItemId, integ, available);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["availability_overrides"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createMenuItem({
        name: form.name,
        description: form.description || null,
        price: form.price,
        available: form.available,
        owner_id: user?.id,
        category_id: form.category_id || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu_items"] });
      toast.success("Item added");
      setIsOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: () =>
      updateMenuItem(form.id!, {
        name: form.name,
        description: form.description || null,
        price: form.price,
        available: form.available,
        category_id: form.category_id || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu_items"] });
      toast.success("Item updated");
      setIsOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteMenuItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu_items"] });
      toast.success("Item deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAvail = useMutation({
    mutationFn: ({ id, available }: { id: string; available: boolean }) =>
      updateMenuItem(id, { available }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu_items"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setIsOpen(true);
  };

  const openEdit = (item: MenuItemRow) => {
    setEditing(item);
    setForm({
      id: item.id,
      name: item.name,
      description: item.description ?? "",
      price: Number(item.price),
      category_id: item.category_id ?? "",
      available: item.available,
    });
    setIsOpen(true);
  };

  const submit = () => {
    if (!form.name || form.price <= 0) {
      toast.error("Name and a positive price are required");
      return;
    }
    if (editing) updateMut.mutate();
    else createMut.mutate();
  };

  const syncAll = async () => {
    setSyncing(true);
    try {
      await logSync(null, "success", "Manual menu sync triggered");
      toast.success("Menu sync logged");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Menu Management</h1>
          <p className="text-muted-foreground">Add, edit, and sync your menu items</p>
        </div>
        <div className="flex gap-3">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button variant="hero" onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" /> Add Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Item" : "New Item"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Price ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={form.category_id || "__none"}
                    onValueChange={(v) =>
                      setForm({ ...form, category_id: v === "__none" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Uncategorized" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Uncategorized</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {categories.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No categories yet — add some below the table to group your items.
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <Label>Available</Label>
                  <Switch
                    checked={form.available}
                    onCheckedChange={(v) => setForm({ ...form, available: v })}
                  />
                </div>
                <Button
                  variant="hero"
                  className="w-full"
                  onClick={submit}
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

          <Button onClick={syncAll} disabled={syncing} variant="coral">
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync All"}
          </Button>
        </div>
      </div>

      <Input
        placeholder="Search menu items…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="rounded-xl border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="p-8 text-center text-destructive">
            Failed to load: {(error as Error).message}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No menu items yet. Click "Add Item" to create one.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Per-platform</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-muted-foreground line-clamp-1">
                        {item.description}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">${Number(item.price).toFixed(2)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={item.available}
                      onCheckedChange={(v) => toggleAvail.mutate({ id: item.id, available: v })}
                    />
                  </TableCell>
                  <TableCell>
                    {integrations.length === 0 ? (
                      <span className="text-xs text-muted-foreground">No integrations</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {integrations.map((integ) => {
                          const on = isOverrideOn(item.id, integ.id);
                          return (
                            <button
                              key={integ.id}
                              type="button"
                              onClick={() =>
                                toggleOverride.mutate({
                                  menuItemId: item.id,
                                  integrationId: integ.id,
                                  available: !on,
                                })
                              }
                              className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                                on
                                  ? "bg-success/10 text-success border-success/30"
                                  : "bg-muted text-muted-foreground border-border line-through"
                              }`}
                              title={`${on ? "Available" : "Hidden"} on ${integ.platform}`}
                            >
                              {integ.platform}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Delete "${item.name}"?`)) deleteMut.mutate(item.id);
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
        )}
      </div>

      {!isLoading && filtered.length > 0 && (
        <Badge variant="secondary">{filtered.length} item(s)</Badge>
      )}

      <CategoryManager />
    </div>
  );
}