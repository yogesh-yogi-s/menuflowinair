import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Languages, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SUPPORTED_LOCALES, isRtl, localeLabel } from "@/lib/locales";
import {
  countItemTranslations,
  listItemTranslations,
  deleteItemTranslation,
  updateItemTranslation,
} from "@/services/translations";
import { listMenuItems } from "@/services/menu";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export function TranslateMenuDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [locale, setLocale] = useState<string>(SUPPORTED_LOCALES[0].code);
  const [translating, setTranslating] = useState(false);

  const { data: counts = {} } = useQuery({
    queryKey: ["translations", "counts"],
    queryFn: countItemTranslations,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["menu_items"],
    queryFn: listMenuItems,
  });

  const { data: translations = [] } = useQuery({
    queryKey: ["translations", "items", locale],
    queryFn: () => listItemTranslations(locale),
    enabled: open,
  });

  const tByItem = new Map(translations.map((t) => [t.menu_item_id, t]));

  const translate = async (onlyMissing: boolean) => {
    setTranslating(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) {
        toast.error("Please sign in again");
        return;
      }
      const res = await fetch("/api/ai/translate-menu", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ locale, only_missing: onlyMissing }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Translation failed");
        return;
      }
      toast.success(
        `Translated ${data.items_inserted} items, ${data.categories_inserted} categories`,
      );
      qc.invalidateQueries({ queryKey: ["translations"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setTranslating(false);
    }
  };

  const updateMut = useMutation({
    mutationFn: ({
      id,
      name,
      description,
    }: {
      id: string;
      name: string;
      description: string;
    }) =>
      updateItemTranslation(id, {
        name,
        description: description || null,
        ai_generated: false,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["translations"] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteItemTranslation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["translations"] });
      toast.success("Translation removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Languages className="mr-2 h-4 w-4" />
          Translate menu
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Translate menu</DialogTitle>
        </DialogHeader>

        <div className="flex items-end gap-3 pt-2 flex-wrap">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Language</label>
            <Select value={locale} onValueChange={setLocale}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LOCALES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.label} {counts[l.code] ? `· ${counts[l.code]}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="hero"
            onClick={() => translate(true)}
            disabled={translating}
          >
            {translating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Languages className="mr-2 h-4 w-4" />
            )}
            Translate missing
          </Button>
          <Button
            variant="outline"
            onClick={() => translate(false)}
            disabled={translating}
          >
            Re-translate all
          </Button>
        </div>

        <div className="mt-4 space-y-2" dir={isRtl(locale) ? "rtl" : "ltr"}>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No menu items yet. Add items first, then translate.
            </p>
          ) : (
            items.map((it) => {
              const t = tByItem.get(it.id);
              return (
                <div
                  key={it.id}
                  className="rounded-lg border p-3 grid gap-2 sm:grid-cols-2"
                >
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Original (en)
                    </div>
                    <div className="font-medium">{it.name}</div>
                    {it.description && (
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {it.description}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {localeLabel(locale)}{" "}
                        {t?.ai_generated && (
                          <Badge variant="secondary" className="ml-1 text-[9px]">
                            AI
                          </Badge>
                        )}
                      </div>
                      {t && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => deleteMut.mutate(t.id)}
                          title="Remove translation"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                    {t ? (
                      <InlineEdit
                        initialName={t.name}
                        initialDescription={t.description ?? ""}
                        onSave={(name, description) =>
                          updateMut.mutate({ id: t.id, name, description })
                        }
                      />
                    ) : (
                      <div className="text-xs italic text-muted-foreground">
                        Not translated yet — click "Translate missing".
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InlineEdit({
  initialName,
  initialDescription,
  onSave,
}: {
  initialName: string;
  initialDescription: string;
  onSave: (name: string, description: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [desc, setDesc] = useState(initialDescription);
  const dirty = name !== initialName || desc !== initialDescription;
  return (
    <div className="space-y-1">
      <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
      <Input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Description"
        className="h-8 text-xs"
      />
      {dirty && (
        <Button
          size="sm"
          variant="outline"
          className="h-7"
          onClick={() => onSave(name, desc)}
        >
          Save
        </Button>
      )}
    </div>
  );
}