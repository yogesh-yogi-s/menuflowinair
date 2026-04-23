import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MenuItem } from "@/types/menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/")({
  component: MenuManagement,
});

const initialItems: MenuItem[] = [
  { id: "1", name: "Truffle Mushroom Burger", description: "House blend beef patty, truffle aioli, brie, and wild mushrooms on a brioche bun.", price: 18.5, category: "Mains", available: true },
  { id: "2", name: "Korean Fried Cauliflower", description: "Crispy cauliflower tossed in gochujang glaze with sesame and scallions.", price: 12, category: "Starters", available: true },
  { id: "3", name: "Mango Smoothie", description: "Alphonso mango, coconut milk, lime, and fresh mint.", price: 7.5, category: "Drinks", available: true },
  { id: "4", name: "Salted Caramel Brownie", description: "Warm chocolate brownie with vanilla bean ice cream and salted caramel.", price: 9, category: "Desserts", available: false },
];

function MenuManagement() {
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const emptyItem: MenuItem = { id: "", name: "", description: "", price: 0, category: "", available: true };
  const [form, setForm] = useState<MenuItem>(emptyItem);

  const openNew = () => { setForm({ ...emptyItem, id: Date.now().toString() }); setEditItem(null); setIsOpen(true); };
  const openEdit = (item: MenuItem) => { setForm(item); setEditItem(item); setIsOpen(true); };

  const save = () => {
    if (!form.name || !form.category || form.price <= 0) { toast.error("Please fill all fields"); return; }
    if (editItem) {
      setItems((prev) => prev.map((i) => (i.id === form.id ? form : i)));
      toast.success("Item updated");
    } else {
      setItems((prev) => [...prev, form]);
      toast.success("Item added");
    }
    setIsOpen(false);
  };

  const remove = (id: string) => { setItems((prev) => prev.filter((i) => i.id !== id)); toast.success("Item deleted"); };

  const toggleAvailable = (id: string) => {
    setItems(items.map((i) => (i.id === id ? { ...i, available: !i.available } : i)));
  };

  const syncAll = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      toast.success("Menu synced to all platforms!");
    }, 2000);
  };

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
                <DialogTitle>{editItem ? "Edit Item" : "New Item"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Price ($)</Label>
                    <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                  </div>
                </div>
                <Button variant="hero" className="w-full" onClick={save}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button onClick={syncAll} disabled={syncing} variant="coral">
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync All"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Available</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-muted-foreground line-clamp-1">{item.description}</div>
                  </div>
                </TableCell>
                <TableCell><Badge variant="secondary">{item.category}</Badge></TableCell>
                <TableCell className="font-medium">${item.price.toFixed(2)}</TableCell>
                <TableCell>
                  <Switch checked={item.available} onCheckedChange={() => toggleAvailable(item.id)} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(item.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}