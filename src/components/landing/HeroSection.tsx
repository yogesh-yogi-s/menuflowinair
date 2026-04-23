import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap } from "lucide-react";
import heroDashboard from "@/assets/hero-dashboard.jpg";

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-accent/50 to-background" />

      <div className="container mx-auto px-4 relative">
        <div className="max-w-3xl mx-auto text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-6">
            <Zap className="h-4 w-4" />
            AI-Powered Menu Management
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-extrabold tracking-tight mb-6">
            One menu. <span className="gradient-text">Every platform.</span> Instant sync.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Stop juggling tablets. Manage your entire restaurant menu across DoorDash, UberEats, and Grubhub from a single dashboard.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup">
              <Button variant="hero" size="lg" className="text-base px-8">
                Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <a href="#features">
              <Button variant="outline" size="lg" className="text-base px-8">
                See How It Works
              </Button>
            </a>
          </div>
        </div>

        <div className="flex items-center justify-center gap-8 mb-12 text-muted-foreground">
          <span className="text-sm font-medium">Syncs with:</span>
          <div className="flex gap-6 items-center">
            {["DoorDash", "UberEats", "Grubhub"].map((name) => (
              <span key={name} className="text-sm font-semibold opacity-60 hover:opacity-100 transition-opacity">
                {name}
              </span>
            ))}
          </div>
        </div>

        <div className="max-w-5xl mx-auto animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <div className="rounded-2xl overflow-hidden shadow-2xl border border-border/50">
            <img
              src={heroDashboard}
              alt="MenuFlow dashboard showing unified menu management"
              width={1600}
              height={1024}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}