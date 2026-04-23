import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Wand2, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/ai-tools")({
  component: AITools,
});

interface GeneratedItem {
  name: string;
  description: string;
  price: number;
  category: string;
}

const sampleResults: GeneratedItem[] = [
  { name: "Grilled Atlantic Salmon", description: "Cedar-plank salmon with lemon herb butter, served over wild rice pilaf and seasonal greens.", price: 26, category: "Mains" },
  { name: "Truffle Parmesan Fries", description: "Crispy hand-cut fries tossed in white truffle oil and aged parmesan, with rosemary aioli.", price: 11, category: "Starters" },
  { name: "Mango Lassi Smoothie", description: "Alphonso mango blended with creamy yogurt, cardamom, and a hint of rosewater.", price: 8, category: "Drinks" },
];

function AITools() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GeneratedItem[]>([]);
  const [addedIdx, setAddedIdx] = useState<Set<number>>(new Set());

  const generate = () => {
    if (!input.trim()) {
      toast.error("Please enter a menu description");
      return;
    }
    setLoading(true);
    setAddedIdx(new Set());
    setTimeout(() => {
      setResults(sampleResults);
      setLoading(false);
      toast.success("Menu items generated!");
    }, 1200);
  };

  const handleAdd = (item: GeneratedItem, i: number) => {
    setAddedIdx((prev) => new Set(prev).add(i));
    toast.success(`"${item.name}" added to menu`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">AI Menu Optimizer</h1>
        <p className="text-muted-foreground">Generate professional menu items from a description</p>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Describe Your Menu
          </CardTitle>
          <CardDescription>
            Type a brief description of items, or paste a menu. The AI agent will craft polished names, descriptions, prices, and categories.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="e.g. 'We serve grilled salmon, truffle fries, and mango smoothies. Upscale casual dining.'"
            rows={4}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <Button variant="hero" onClick={generate} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            {loading ? "Generating..." : "Generate Menu Items"}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-display font-semibold">Generated Items</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {results.map((item, i) => {
              const added = addedIdx.has(i);
              return (
                <Card key={i} className="border-border/50 animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{item.name}</CardTitle>
                      <span className="text-lg font-bold text-primary">${item.price.toFixed(2)}</span>
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
                      disabled={added}
                    >
                      {added ? (
                        <>
                          <Check className="mr-2 h-4 w-4" /> Added
                        </>
                      ) : (
                        "Add to Menu"
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