import { createFileRoute, redirect, Outlet, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.navigate({ to: "/login", search: { redirect: router.state.location.href } });
    }
  }, [loading, session, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!session) return null;
  return <Outlet />;
}

// Note: we use a client-side guard (via useEffect) instead of beforeLoad because
// auth state lives in React context (AuthProvider), not router context. This
// still prevents protected content from rendering before redirect.
export { redirect };