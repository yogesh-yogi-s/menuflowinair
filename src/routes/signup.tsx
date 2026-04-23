import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Utensils } from "lucide-react";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Sign up — MenuFlow" }] }),
  component: SignupPage,
});

function SignupPage() {
  const [form, setForm] = useState({ name: "", restaurant_name: "", email: "", password: "" });
  const navigate = useNavigate();

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/dashboard" });
  };

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md animate-fade-in">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-lg gradient-hero flex items-center justify-center">
            <Utensils className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-display font-bold">MenuFlow</span>
        </Link>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-display">Create your account</CardTitle>
            <CardDescription>Start your 14-day free trial</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" placeholder="John Doe" value={form.name} onChange={update("name")} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="restaurant_name">Restaurant Name</Label>
                <Input id="restaurant_name" placeholder="Joe's Kitchen" value={form.restaurant_name} onChange={update("restaurant_name")} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@restaurant.com" value={form.email} onChange={update("email")} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="••••••••" minLength={6} value={form.password} onChange={update("password")} required />
              </div>
              <Button type="submit" variant="hero" className="w-full">Create Account</Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              Already have an account?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">Log in</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}