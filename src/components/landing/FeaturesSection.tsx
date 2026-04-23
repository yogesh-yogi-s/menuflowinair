import { RefreshCw, Sparkles, ToggleLeft, Layers } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const features = [
  {
    icon: Layers,
    title: "Unified Menu Editor",
    description:
      "One central hub to manage item names, prices, descriptions, and categories across every delivery platform.",
  },
  {
    icon: Sparkles,
    title: "AI Menu Optimizer",
    description:
      "Type a description and AI generates professional, structured menu data instantly.",
  },
  {
    icon: RefreshCw,
    title: "One-Click Sync",
    description:
      "Push changes to DoorDash, UberEats, and Grubhub simultaneously. No more tablet-hopping.",
  },
  {
    icon: ToggleLeft,
    title: "Availability Toggle",
    description: "86 an item across every platform with a single switch.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
            Everything you need to <span className="gradient-text">run your menu</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            From AI-powered optimization to instant multi-platform sync, MenuFlow has you covered.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="border-border/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-card"
            >
              <CardHeader>
                <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}