import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Camera, Upload, Loader2, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { uploadDishPhoto } from "@/services/dish-photos";
import {
  createMenuItem,
  listCategories,
  createCategory,
} from "@/services/menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface Described {
  name: string;
  description: string;
  suggested_price: number;
  category_guess: string;
}

export function DescribeFromPhotoDialog() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<Described | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: 0,
    category_id: "",
  });
  const fileRef = useRef<HTMLInputElement | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
  });

  const reset = () => {
    setImageUrl("");
    setResult(null);
    setForm({ name: "", description: "", price: 0, category_id: "" });
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setUploading(true);
    try {
      const url = await uploadDishPhoto(user.id, file);
      setImageUrl(url);
      toast.success("Photo uploaded — click Analyze");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const analyze = async () => {
    if (!imageUrl) {
      toast.error("Upload or paste an image URL first");
      return;
    }
    setAnalyzing(true);
    setResult(null);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) {
        toast.error("Please sign in again");
        return;
      }
      const res = await fetch("/api/ai/describe-photo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ image_url: imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to describe photo");
        return;
      }
      const dish = data.dish as Described;
      setResult(dish);
      const matched = categories.find(
        (c) => c.name.toLowerCase() === dish.category_guess.toLowerCase(),
      );
      setForm({
        name: dish.name,
        description: dish.description,
        price: dish.suggested_price,
        category_id: matched?.id ?? "",
      });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAnalyzing(false);
    }
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not signed in");
      let categoryId = form.category_id || null;
      if (!categoryId && result?.category_guess) {
        const created = await createCategory({
          name: result.category_guess,
          owner_id: user.id,
          sort_order: categories.length,
        });
        categoryId = created.id;
      }
      return createMenuItem({
        owner_id: user.id,
        name: form.name,
        description: form.description || null,
        price: form.price,
        available: true,
        category_id: categoryId,
        image_url: imageUrl || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menu_items"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Item added to menu");
      reset();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Camera className="mr-2 h-4 w-4" />
          Describe from photo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Describe a dish from its photo
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="upload" className="pt-2">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="url">Image URL</TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="pt-3 space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Choose photo
            </Button>
          </TabsContent>
          <TabsContent value="url" className="pt-3 space-y-2">
            <Label className="text-xs">Image URL</Label>
            <Input
              placeholder="https://..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </TabsContent>
        </Tabs>

        {imageUrl && (
          <div className="mt-3 rounded-lg border overflow-hidden bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Dish preview"
              className="w-full max-h-56 object-cover"
            />
          </div>
        )}

        {imageUrl && !result && (
          <Button
            variant="hero"
            className="w-full mt-3"
            onClick={analyze}
            disabled={analyzing}
          >
            {analyzing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {analyzing ? "Analyzing…" : "Analyze with AI"}
          </Button>
        )}

        {result && (
          <div className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Price ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) =>
                    setForm({ ...form, price: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category guess</Label>
                <Input value={result.category_guess} disabled />
              </div>
            </div>
            <Button
              variant="hero"
              className="w-full"
              onClick={() => saveMut.mutate()}
              disabled={!form.name || form.price <= 0 || saveMut.isPending}
            >
              {saveMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Add to menu
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}