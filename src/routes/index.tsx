import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { Footer } from "@/components/landing/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MenuFlow — One menu. Every platform. Instant sync." },
      {
        name: "description",
        content:
          "Manage your restaurant menu across DoorDash, UberEats, and Grubhub from a single dashboard. AI-powered menu management.",
      },
      { property: "og:title", content: "MenuFlow — Unified Restaurant Menu Management" },
      {
        property: "og:description",
        content: "Stop juggling tablets. Sync menus across every delivery platform in one click.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <PricingSection />
      <Footer />
    </div>
  );
}
