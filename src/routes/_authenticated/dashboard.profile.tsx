import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, User as UserIcon, Mail, Lock, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getMyProfile, updateMyProfile, type ProfileRow } from "@/services/profile";
import { uploadAvatar } from "@/services/avatar";
import { supabase } from "@/integrations/supabase/client";
import { PublicMenuCard } from "@/components/profile/PublicMenuCard";

export const Route = createFileRoute("/_authenticated/dashboard/profile")({
  head: () => ({ meta: [{ title: "Profile — MenuFlow" }] }),
  component: ProfilePage,
});

function getInitials(name?: string | null, email?: string | null): string {
  const source = (name && name.trim()) || (email && email.split("@")[0]) || "U";
  const parts = source.trim().split(/\s+/);
  const letters = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2);
  return letters.toUpperCase();
}

function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ full_name: "", restaurant_name: "", phone: "", avatar_url: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file || !user) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(user.id, file);
      setForm((f) => ({ ...f, avatar_url: url }));
      // Persist immediately so the sidebar updates without needing "Save".
      const updated = await updateMyProfile(user.id, { avatar_url: url });
      setProfile(updated);
      await refreshProfile();
      toast.success("Avatar updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    setForm((f) => ({ ...f, avatar_url: "" }));
    try {
      const updated = await updateMyProfile(user.id, { avatar_url: null });
      setProfile(updated);
      await refreshProfile();
      toast.success("Avatar removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove avatar");
    }
  };

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
      await refreshProfile();
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

  const initials = getInitials(form.full_name || profile?.full_name, user?.email);

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
          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* Avatar block */}
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                {form.avatar_url && <AvatarImage src={form.avatar_url} alt="Avatar preview" />}
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFilePicked}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Upload from gallery
                  </Button>
                  {form.avatar_url && (
                    <Button type="button" variant="ghost" size="sm" onClick={handleRemoveAvatar}>
                      <X className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">PNG or JPG, up to 2 MB.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatar_url">Or paste an image URL</Label>
              <Input
                id="avatar_url"
                type="url"
                placeholder="https://..."
                value={form.avatar_url}
                onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                maxLength={500}
              />
            </div>

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
            </div>
            <Button type="submit" disabled={savingProfile}>
              {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {user && profile && (
        <PublicMenuCard
          userId={user.id}
          profile={profile}
          onProfileChanged={(p) => setProfile(p)}
        />
      )}

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
