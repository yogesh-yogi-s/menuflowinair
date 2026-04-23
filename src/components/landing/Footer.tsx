import { Utensils } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t py-12 bg-muted/30">
      <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg gradient-hero flex items-center justify-center">
            <Utensils className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold">MenuFlow</span>
        </div>
        <p className="text-sm text-muted-foreground">© 2026 MenuFlow. All rights reserved.</p>
      </div>
    </footer>
  );
}