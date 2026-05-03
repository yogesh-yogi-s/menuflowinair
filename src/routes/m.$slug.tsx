import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicMenuView, type PublicMenuData } from "@/components/menu/PublicMenuView";

async function fetchPublicMenu(slug: string): Promise<PublicMenuData | null> {
  const { data, error } = await supabase.rpc("get_public_menu", { _slug: slug });
  if (error) throw error;
  if (!data) return null;
  return data as unknown as PublicMenuData;
}

export const Route = createFileRoute("/m/$slug")({
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData({
      queryKey: ["public_menu", params.slug],
      queryFn: () => fetchPublicMenu(params.slug),
      staleTime: 60_000,
    });
    if (!data) throw notFound();
    return { data };
  },
  head: ({ loaderData }) => {
    const r = loaderData?.data?.restaurant;
    const title = r ? `${r.restaurant_name || r.full_name || "Menu"} — Menu` : "Menu";
    const description = r?.tagline || "View our menu";
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
    ];
    if (r?.avatar_url) {
      meta.push({ property: "og:image", content: r.avatar_url });
      meta.push({ name: "twitter:image", content: r.avatar_url });
    }
    return { meta };
  },
  component: PublicMenuPage,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <h1 className="text-2xl font-display font-bold">Menu not found</h1>
        <p className="text-muted-foreground mt-2">
          This menu link doesn't exist or has been removed.
        </p>
        <Link to="/" className="mt-4 inline-block text-primary underline">Go home</Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <h1 className="text-xl font-bold">Couldn't load menu</h1>
        <p className="text-muted-foreground text-sm mt-2">{error.message}</p>
      </div>
    </div>
  ),
});

function PublicMenuPage() {
  const { slug } = Route.useParams();
  const { data: initial } = Route.useLoaderData();
  const { data } = useQuery({
    queryKey: ["public_menu", slug],
    queryFn: () => fetchPublicMenu(slug),
    initialData: initial,
    staleTime: 60_000,
  });
  if (!data) return null;
  return <PublicMenuView data={data} />;
}