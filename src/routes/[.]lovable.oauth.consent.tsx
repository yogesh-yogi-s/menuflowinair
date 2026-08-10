import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Utensils, Loader2, ShieldCheck } from "lucide-react";

type OauthResult = {
  client?: { name?: string | null; client_id?: string | null } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
  scope?: string | null;
};

// `supabase.auth.oauth` is a beta namespace not yet in the published types.
const oauth = (
  supabase.auth as unknown as {
    oauth: {
      getAuthorizationDetails: (id: string) => Promise<{ data: OauthResult | null; error: Error | null }>;
      approveAuthorization: (id: string) => Promise<{ data: OauthResult | null; error: Error | null }>;
      denyAuthorization: (id: string) => Promise<{ data: OauthResult | null; error: Error | null }>;
    };
  }
).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser-only: the Supabase client reads its session from localStorage.
  ssr: false,
  head: () => ({ meta: [{ title: "Authorize access — MenuFlow" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.pathname + location.searchStr },
      });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <Shell>
      <p className="text-sm text-destructive">
        Could not load this authorization request: {String((error as Error)?.message ?? error)}
      </p>
    </Shell>
  ),
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-lg gradient-hero flex items-center justify-center">
            <Utensils className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-display font-bold">MenuFlow</span>
        </div>
        <Card className="border-border/50 shadow-xl">
          <CardContent className="pt-6">{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? "an application";

  async function decide(approve: boolean) {
    setBusy(approve ? "approve" : "deny");
    setError(null);
    const { data, error: err } = approve
      ? await oauth.approveAuthorization(authorization_id)
      : await oauth.denyAuthorization(authorization_id);
    if (err) {
      setBusy(null);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(null);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-lg gradient-hero flex items-center justify-center">
            <Utensils className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-display font-bold">MenuFlow</span>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-xl font-display">Connect {clientName}</CardTitle>
            <CardDescription>
              {clientName} is asking to use MenuFlow as you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ul className="text-sm text-muted-foreground space-y-2 rounded-lg border border-border/60 bg-muted/30 p-4">
              <li>• Read and edit your menu items and categories</li>
              <li>• View your delivery-platform integrations</li>
              <li>• Read orders and update their status</li>
            </ul>
            <p className="text-xs text-muted-foreground">
              Only your own restaurant data is accessible. You can revoke this access at any time
              from your Supabase account settings.
            </p>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy !== null}
                onClick={() => decide(false)}
              >
                {busy === "deny" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Deny
              </Button>
              <Button
                variant="hero"
                className="flex-1"
                disabled={busy !== null}
                onClick={() => decide(true)}
              >
                {busy === "approve" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Approve
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}