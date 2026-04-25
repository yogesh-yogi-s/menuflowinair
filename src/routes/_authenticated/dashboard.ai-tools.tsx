import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Wand2, Loader2, Check, Save } from "lucide-react";
import { toast } from "sonner";
import { createMenuItem } from "@/services/menu";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/dashboard/ai-tools")({
  component: AITools,
});

interface GeneratedItem {
  name: string;
  description: string;
  price: number;
  category: string;
}

function AITools() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GeneratedItem[]>([]);
  const [addedIdx, setAddedIdx] = useState<Set<number>>(new Set());
  const [savingAll, setSavingAll] = useState(false);

  const addMut = useMutation({
    mutationFn: (item: GeneratedItem) =>
      createMenuItem({
        name: item.name,
        description: item.description,
        price: item.price,
        available: true,
        owner_id: user?.id,
      }),
    onSuccess: (_d, item) => {
      qc.invalidateQueries({ queryKey: ["menu_items"] });
      toast.success(`"${item.name}" added to menu`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generate = async () => {
    if (!input.trim()) {
      toast.error("Please enter a menu description");
      return;
    }
    setLoading(true);
    setAddedIdx(new Set());
    setResults([]);
    try {
      const res = await fetch("/api/ai/generate-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to generate items");
        return;
      }
      const items: GeneratedItem[] = data.items ?? [];
      if (items.length === 0) {
        toast.error("No items generated. Try a different prompt.");
        return;
      }
      setResults(items);
      toast.success(`Generated ${items.length} menu items`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = (item: GeneratedItem, i: number) => {
    addMut.mutate(item, { onSuccess: () => setAddedIdx((prev) => new Set(prev).add(i)) });
  };

  const saveAll = async () => {
    if (!user?.id) {
      toast.error("Not signed in");
      return;
    }
    setSavingAll(true);
    let saved = 0;
    const newAdded = new Set(addedIdx);
    for (let i = 0; i < results.length; i++) {
      if (newAdded.has(i)) continue;
      const item = results[i];
      try {
        await createMenuItem({
          name: item.name,
          description: item.description,
          price: item.price,
          available: true,
          owner_id: user.id,
        });
        newAdded.add(i);
        saved++;
      } catch (e) {
        toast.error(`Failed to save "${item.name}": ${(e as Error).message}`);
      }
    }
    setAddedIdx(newAdded);
    setSavingAll(false);
    qc.invalidateQueries({ queryKey: ["menu_items"] });
    if (saved > 0) toast.success(`Saved ${saved} item(s) to menu`);
  };

  const allAdded = results.length > 0 && addedIdx.size === results.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">AI Menu Generator</h1>
        <p className="text-muted-foreground">
          Describe your restaurant or dishes — AI will generate fresh menu items you can save directly.
        </p>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Describe Your Menu
          </CardTitle>
          <CardDescription>
            E.g. "Modern Italian trattoria, mid-range, focusing on handmade pasta and seasonal seafood."
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Describe your cuisine, vibe, signature dishes, price range…"
            rows={4}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            maxLength={2000}
          />
          <Button variant="hero" onClick={generate} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="mr-2 h-4 w-4" />
            )}
            {loading ? "Generating..." : "Generate Menu Items"}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-display font-semibold">Generated Items</h2>
            <Button onClick={saveAll} disabled={savingAll || allAdded} variant="coral">
              {savingAll ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {allAdded ? "All saved" : "Save All to Menu"}
            </Button>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {results.map((item, i) => {
              const added = addedIdx.has(i);
              return (
                <Card
                  key={i}
                  className="border-border/50 animate-fade-in"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{item.name}</CardTitle>
                      <span className="text-lg font-bold text-primary">
                        ${item.price.toFixed(2)}
                      </span>
                    </div>
                    <CardDescription className="text-xs">{item.category}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                    <Button
                      variant={added ? "outline" : "hero"}
                      size="sm"
                      className="mt-4 w-full"
                      onClick={() => handleAdd(item, i)}
                      disabled={added || addMut.isPending}
                    >
                      {added ? (
                        <>
                          <Check className="mr-2 h-4 w-4" /> Saved
                        </>
                      ) : (
                        "Save to Menu"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
