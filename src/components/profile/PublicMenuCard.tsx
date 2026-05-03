import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Copy, ExternalLink, QrCode, Check, AlertCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  isSlugAvailable,
  slugify,
  updateMyProfile,
  type ProfileRow,
} from "@/services/profile";

interface Props {
  userId: string;
  profile: ProfileRow;
  onProfileChanged: (next: ProfileRow) => void;
}

type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export function PublicMenuCard({ userId, profile, onProfileChanged }: Props) {
  const initialSlug = profile.slug ?? slugify(profile.restaurant_name ?? "");
  const [slug, setSlug] = useState(initialSlug);
  const [tagline, setTagline] = useState(profile.tagline ?? "");
  const [status, setStatus] = useState<SlugStatus>("idle");
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const publicUrl = useMemo(() => {
    if (typeof window === "undefined" || !slug) return "";
    return `${window.location.origin}/m/${slug}`;
  }, [slug]);

  // Debounced availability check
  useEffect(() => {
    const trimmed = slug.trim();
    if (!trimmed) {
      setStatus("idle");
      return;
    }
    if (!/^[a-z0-9-]{2,60}$/.test(trimmed)) {
      setStatus("invalid");
      return;
    }
    if (trimmed === profile.slug) {
      setStatus("available");
      return;
    }
    setStatus("checking");
    const t = setTimeout(async () => {
      const ok = await isSlugAvailable(trimmed, userId);
      setStatus(ok ? "available" : "taken");
    }, 400);
    return () => clearTimeout(t);
  }, [slug, userId, profile.slug]);

  // Render QR code whenever publicUrl changes
  useEffect(() => {
    if (!publicUrl || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, publicUrl, { width: 192, margin: 1 }).catch(() => {
      /* ignore */
    });
  }, [publicUrl]);

  const handleSave = async () => {
    const trimmed = slug.trim();
    if (status === "invalid") {
      toast.error("Slug must be 2–60 characters: lowercase letters, numbers, dashes.");
      return;
    }
    if (status === "taken") {
      toast.error("That slug is already taken.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateMyProfile(userId, {
        slug: trimmed || null,
        tagline: tagline.trim() || null,
      });
      onProfileChanged(updated);
      toast.success("Public menu updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const handleDownloadQR = async () => {
    if (!publicUrl) return;
    try {
      const dataUrl = await QRCode.toDataURL(publicUrl, { width: 1024, margin: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${slug || "menu"}-qr.png`;
      a.click();
    } catch {
      toast.error("Couldn't generate QR");
    }
  };

  const statusBadge = () => {
    switch (status) {
      case "checking":
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Checking
          </Badge>
        );
      case "available":
        return (
          <Badge className="gap-1 bg-green-600 hover:bg-green-600">
            <Check className="h-3 w-3" /> Available
          </Badge>
        );
      case "taken":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" /> Taken
          </Badge>
        );
      case "invalid":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" /> Invalid
          </Badge>
        );
      default:
        return null;
    }
  };

  const liveSlug = profile.slug;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5" /> Public menu
        </CardTitle>
        <CardDescription>
          A shareable, mobile-friendly menu page that anyone can open—no login required.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="slug">URL slug</Label>
              {statusBadge()}
            </div>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="my-restaurant"
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, and dashes only.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Authentic wood-fired pizza"
              maxLength={120}
            />
            <p className="text-xs text-muted-foreground">
              Shows under your restaurant name on the public page.
            </p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving || status === "checking" || status === "taken" || status === "invalid"}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>

        {liveSlug && (
          <div className="border-t pt-6 space-y-4">
            <div className="space-y-2">
              <Label>Public URL</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input readOnly value={`${typeof window !== "undefined" ? window.location.origin : ""}/m/${liveSlug}`} />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                    <Copy className="h-4 w-4 mr-2" /> Copy
                  </Button>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={`/m/${liveSlug}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" /> Open
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="rounded-lg border bg-card p-3">
                <canvas ref={canvasRef} aria-label="Menu QR code" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <QrCode className="h-4 w-4" /> QR code
                </p>
                <p className="text-xs text-muted-foreground">
                  Print this and put it on your tables, business cards, or window.
                </p>
                <Button type="button" variant="outline" size="sm" onClick={handleDownloadQR}>
                  Download PNG
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}