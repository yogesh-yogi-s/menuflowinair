import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "@/components/menu/LanguageSwitcher";
import { isRtl, SUPPORTED_LOCALES } from "@/lib/locales";

export interface PublicMenuRestaurant {
  id: string;
  full_name: string | null;
  restaurant_name: string | null;
  avatar_url: string | null;
  slug: string | null;
  tagline: string | null;
}

export interface PublicMenuCategory {
  id: string;
  name: string;
  sort_order: number;
}

export interface PublicMenuItem {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  available: boolean;
  image_url: string | null;
}

export interface PublicMenuData {
  restaurant: PublicMenuRestaurant;
  categories: PublicMenuCategory[];
  items: PublicMenuItem[];
}

function getInitials(name?: string | null): string {
  const source = (name && name.trim()) || "R";
  const parts = source.trim().split(/\s+/);
  const letters = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2);
  return letters.toUpperCase();
}

function formatPrice(value: number): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

const OTHER_KEY = "__other__";

interface ViewProps {
  data: PublicMenuData;
  lang?: string;
  onLangChange?: (lang: string) => void;
}

export function PublicMenuView({ data, lang = "en", onLangChange }: ViewProps) {
  const { restaurant, categories, items } = data;

  const ownerId = restaurant.id;
  const itemIds = useMemo(() => items.map((i) => i.id), [items]);
  const catIds = useMemo(() => categories.map((c) => c.id), [categories]);

  // Discover which locales have any translations for this owner (for switcher).
  const { data: availableLocales = [] } = useQuery({
    queryKey: ["public_menu_locales", ownerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_item_translations")
        .select("locale")
        .eq("owner_id", ownerId);
      if (error) return [];
      const set = new Set<string>();
      for (const r of data ?? []) set.add(r.locale);
      return Array.from(set);
    },
    enabled: !!ownerId,
    staleTime: 5 * 60_000,
  });

  const useLang = lang !== "en" && SUPPORTED_LOCALES.some((l) => l.code === lang);

  const { data: itemTranslations = [] } = useQuery({
    queryKey: ["public_item_trans", ownerId, lang],
    queryFn: async () => {
      if (!useLang || itemIds.length === 0) return [];
      const { data, error } = await supabase
        .from("menu_item_translations")
        .select("menu_item_id,name,description")
        .eq("locale", lang)
        .in("menu_item_id", itemIds);
      if (error) return [];
      return data ?? [];
    },
    enabled: useLang && itemIds.length > 0,
    staleTime: 60_000,
  });

  const { data: catTranslations = [] } = useQuery({
    queryKey: ["public_cat_trans", ownerId, lang],
    queryFn: async () => {
      if (!useLang || catIds.length === 0) return [];
      const { data, error } = await supabase
        .from("category_translations")
        .select("category_id,name")
        .eq("locale", lang)
        .in("category_id", catIds);
      if (error) return [];
      return data ?? [];
    },
    enabled: useLang && catIds.length > 0,
    staleTime: 60_000,
  });

  const itemTransMap = useMemo(() => {
    const m = new Map<string, { name: string; description: string | null }>();
    for (const t of itemTranslations)
      m.set(t.menu_item_id, { name: t.name, description: t.description });
    return m;
  }, [itemTranslations]);

  const catTransMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of catTranslations) m.set(t.category_id, t.name);
    return m;
  }, [catTranslations]);

  const sections = useMemo(() => {
    const ordered = [...categories].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
    );
    const result = ordered.map((c) => ({
      key: c.id,
      name: catTransMap.get(c.id) ?? c.name,
      items: items.filter((i) => i.category_id === c.id).map((i) => ({
        ...i,
        name: itemTransMap.get(i.id)?.name ?? i.name,
        description: itemTransMap.get(i.id)?.description ?? i.description,
      })),
    }));
    const orphans = items
      .filter((i) => !i.category_id || !ordered.some((c) => c.id === i.category_id))
      .map((i) => ({
        ...i,
        name: itemTransMap.get(i.id)?.name ?? i.name,
        description: itemTransMap.get(i.id)?.description ?? i.description,
      }));
    if (orphans.length) {
      result.push({ key: OTHER_KEY, name: "Other", items: orphans });
    }
    return result.filter((s) => s.items.length > 0);
  }, [categories, items, itemTransMap, catTransMap]);

  const [activeKey, setActiveKey] = useState<string | null>(sections[0]?.key ?? null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const key = (visible.target as HTMLElement).dataset.sectionKey;
          if (key) setActiveKey(key);
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    sections.forEach((s) => {
      const el = sectionRefs.current[s.key];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  const scrollTo = (key: string) => {
    const el = sectionRefs.current[key];
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const title = restaurant.restaurant_name || restaurant.full_name || "Menu";
  const dir = isRtl(lang) ? "rtl" : "ltr";

  return (
    <div className="min-h-screen bg-background text-foreground" dir={dir}>
      <header className="border-b bg-card">
        <div className="mx-auto max-w-2xl px-4 py-6 flex items-center gap-4 flex-wrap">
          <Avatar className="h-16 w-16">
            {restaurant.avatar_url && <AvatarImage src={restaurant.avatar_url} alt={title} />}
            <AvatarFallback className="text-lg">{getInitials(title)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-display font-bold truncate">{title}</h1>
            {restaurant.tagline && (
              <p className="text-sm text-muted-foreground line-clamp-2">{restaurant.tagline}</p>
            )}
          </div>
          {onLangChange && (
            <LanguageSwitcher
              current={lang}
              available={availableLocales}
              onChange={onLangChange}
            />
          )}
        </div>
        {sections.length > 1 && (
          <nav className="sticky top-0 z-10 bg-card/95 backdrop-blur border-t">
            <div className="mx-auto max-w-2xl px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar">
              {sections.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => scrollTo(s.key)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-sm transition-colors",
                    activeKey === s.key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground hover:bg-muted",
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-10">
        {sections.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No menu items yet.</p>
        )}
        {sections.map((s) => (
          <section
            key={s.key}
            data-section-key={s.key}
            ref={(el) => {
              sectionRefs.current[s.key] = el;
            }}
            className="scroll-mt-20"
          >
            <h2 className="text-xl font-display font-semibold mb-3">{s.name}</h2>
            <ul className="divide-y border rounded-lg bg-card">
              {s.items.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "flex gap-3 p-3",
                    !item.available && "opacity-60",
                  )}
                >
                  {item.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt={item.name}
                      loading="lazy"
                      className="h-16 w-16 rounded-md object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium truncate">{item.name}</h3>
                      <span className="text-sm font-medium tabular-nums">{formatPrice(item.price)}</span>
                    </div>
                    {item.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                    )}
                    {!item.available && (
                      <Badge variant="secondary" className="mt-1">Unavailable</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Powered by MenuFlow
      </footer>
    </div>
  );
}