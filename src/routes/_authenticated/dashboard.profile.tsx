import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, User as UserIcon, Mail, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getMyProfile, updateMyProfile, type ProfileRow } from "@/services/profile";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard/profile")({
  head: () => ({ meta: [{ title: "Profile — MenuFlow" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ full_name: "", restaurant_name: "", phone: "", avatar_url: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [pw, setPw] = useState({ next: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    if (!user) return;
    getMyProfile(user.id)
      .then((p) => {
        setProfile(p);
        if (p) {
          setForm({
            full_name: p.full_name ?? "",
            restaurant_name: p.restaurant_name ?? "",
            phone: p.phone ?? "",
            avatar_url: p.avatar_url ?? "",
          });
        }
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load profile"))
      .finally(() => setLoading(false));
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      const updated = await updateMyProfile(user.id, {
        full_name: form.full_name.trim() || null,
        restaurant_name: form.restaurant_name.trim() || null,
        phone: form.phone.trim() || null,
        avatar_url: form.avatar_url.trim() || null,
      });
      setProfile(updated);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim();
    if (!email) return;
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email });
    setSavingEmail(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Confirmation link sent to the new email address.");
    setNewEmail("");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (pw.next !== pw.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    setSavingPw(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    setPw({ next: "", confirm: "" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-display font-bold">Profile</h1>
        <p className="text-muted-foreground">Manage your account information and security.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserIcon className="h-5 w-5" /> Profile information</CardTitle>
          <CardDescription>Update your personal and restaurant details.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input id="full_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="restaurant_name">Restaurant Name</Label>
                <Input id="restaurant_name" value={form.restaurant_name} onChange={(e) => setForm({ ...form, restaurant_name: e.target.value })} maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={30} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="avatar_url">Avatar URL</Label>
                <Input id="avatar_url" type="url" placeholder="https://..." value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} maxLength={500} />
              </div>
            </div>
            <Button type="submit" disabled={savingProfile}>
              {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Email</CardTitle>
          <CardDescription>
            Current: <span className="font-medium text-foreground">{profile?.email ?? user?.email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangeEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_email">New email</Label>
              <Input id="new_email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@example.com" />
              <p className="text-xs text-muted-foreground">A confirmation link will be sent to the new address before it takes effect.</p>
            </div>
            <Button type="submit" disabled={savingEmail || !newEmail}>
              {savingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Change email
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> Password</CardTitle>
          <CardDescription>Choose a strong password you don't use elsewhere.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new_pw">New password</Label>
                <Input id="new_pw" type="password" minLength={6} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_pw">Confirm password</Label>
                <Input id="confirm_pw" type="password" minLength={6} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
              </div>
            </div>
            <Button type="submit" disabled={savingPw || !pw.next || !pw.confirm}>
              {savingPw && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}