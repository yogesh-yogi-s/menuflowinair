import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Trash2, Plus, Check, X, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listMenuItems,
  createMenuItem,
  updateMenuItem,
  type CategoryRow,
  type MenuItemRow,
} from "@/services/menu";
import { useAuth } from "@/hooks/use-auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

function AddItemControl({
  categoryId,
  ownerId,
  uncategorizedAndOthers,
  onAdded,
}: {
  categoryId: string;
  ownerId?: string;
  uncategorizedAndOthers: MenuItemRow[];
  onAdded: () => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [search, setSearch] = useState("");

  const createMut = useMutation({
    mutationFn: () =>
      createMenuItem({
        name: name.trim(),
        price: parseFloat(price) || 0,
        available: true,
        owner_id: ownerId,
        category_id: categoryId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu_items"] });
      toast.success("Item added");
      setName("");
      setPrice("");
      setOpen(false);
      onAdded();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveMut = useMutation({
    mutationFn: (itemId: string) => updateMenuItem(itemId, { category_id: categoryId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu_items"] });
      toast.success("Item added to category");
      onAdded();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = uncategorizedAndOthers.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-3.5 w-3.5 mr-1" /> Add item
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <Tabs defaultValue="new">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="new">New item</TabsTrigger>
            <TabsTrigger value="existing">Existing</TabsTrigger>
          </TabsList>
          <TabsContent value="new" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Margherita Pizza"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Price ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <Button
              variant="hero"
              className="w-full"
              size="sm"
              disabled={!name.trim() || parseFloat(price) <= 0 || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create & add"
              )}
            </Button>
          </TabsContent>
          <TabsContent value="existing" className="space-y-2 pt-3">
            <Input
              placeholder="Search items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8"
            />
            <div className="max-h-56 overflow-y-auto border rounded-md divide-y">
              {filtered.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground text-center">
                  No items available to move here.
                </div>
              ) : (
                filtered.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => moveMut.mutate(it.id)}
                    disabled={moveMut.isPending}
                    className="w-full text-left p-2 hover:bg-accent flex items-center justify-between gap-2"
                  >
                    <span className="text-sm truncate">{it.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ${Number(it.price).toFixed(2)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

export function CategoryManager() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["menu_items"],
    queryFn: listMenuItems,
  });

  const itemsByCat = items.reduce<Record<string, MenuItemRow[]>>((acc, it) => {
    const key = it.category_id ?? "__uncategorized";
    (acc[key] ||= []).push(it);
    return acc;
  }, {});

  const removeFromCategory = useMutation({
    mutationFn: (itemId: string) => updateMenuItem(itemId, { category_id: null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu_items"] });
      toast.success("Item removed from category");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createCategory({
        name: newName.trim(),
        sort_order: categories.length,
        owner_id: user?.id,
      }),
    onSuccess: (cat) => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category added");
      setNewName("");
      if (cat?.id) setExpanded((s) => ({ ...s, [cat.id]: true }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (cat: CategoryRow) => updateCategory(cat.id, { name: editingName.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category renamed");
      setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["menu_items"] });
      toast.success("Category deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (cat: CategoryRow) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Categories</CardTitle>
        <p className="text-xs text-muted-foreground">
          Group menu items into sections like Starters, Mains, Desserts. Used for menu layout
          and per-section delivery-platform syncing.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="New category name…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) createMut.mutate();
            }}
          />
          <Button
            variant="hero"
            onClick={() => createMut.mutate()}
            disabled={!newName.trim() || createMut.isPending}
          >
            {createMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : categories.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-md">
            No categories yet. Add your first one above.
          </div>
        ) : (
          <ul className="divide-y border rounded-md">
            {categories.map((c) => {
              const catItems = itemsByCat[c.id] ?? [];
              const isOpen = !!expanded[c.id];
              const movable = items.filter((i) => i.category_id !== c.id);
              return (
                <li key={c.id} className="p-2">
                  <div className="flex items-center gap-2">
                    {editingId === c.id ? (
                      <>
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-8"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => updateMut.mutate(c)}
                          disabled={!editingName.trim()}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() =>
                            setExpanded((s) => ({ ...s, [c.id]: !s[c.id] }))
                          }
                        >
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        <span className="flex-1 text-sm font-medium">{c.name}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {catItems.length}
                        </Badge>
                        <Button size="icon" variant="ghost" onClick={() => startEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (
                              confirm(
                                `Delete "${c.name}"? Items in it will become uncategorized.`,
                              )
                            )
                              deleteMut.mutate(c.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>

                  {isOpen && editingId !== c.id && (
                    <div className="mt-2 ml-9 space-y-2">
                      {catItems.length === 0 ? (
                        <div className="text-xs text-muted-foreground italic">
                          No items in this category yet.
                        </div>
                      ) : (
                        <ul className="border rounded-md divide-y bg-muted/30">
                          {catItems.map((it) => (
                            <li
                              key={it.id}
                              className="flex items-center justify-between gap-2 px-2 py-1.5"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-sm truncate">{it.name}</div>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                ${Number(it.price).toFixed(2)}
                              </span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                title="Remove from category"
                                onClick={() => removeFromCategory.mutate(it.id)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <AddItemControl
                        categoryId={c.id}
                        ownerId={user?.id}
                        uncategorizedAndOthers={movable}
                        onAdded={() => setExpanded((s) => ({ ...s, [c.id]: true }))}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}