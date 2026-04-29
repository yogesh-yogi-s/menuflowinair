import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, getMyRoles, type ProfileRow } from "@/services/profile";
import type { AppRole } from "@/integrations/supabase/database.types";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  profile: ProfileRow | null;
  loading: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, meta?: { full_name?: string; restaurant_name?: string }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfileAndRoles = useCallback((userId: string) => {
    getMyRoles(userId).then(setRoles).catch(() => setRoles([]));
    getMyProfile(userId).then(setProfile).catch(() => setProfile(null));
  }, []);

  useEffect(() => {
    // Set up listener BEFORE getSession (Supabase recommendation).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      // Defer non-auth Supabase calls to avoid deadlocks.
      if (newSession?.user) {
        const uid = newSession.user.id;
        setTimeout(() => loadProfileAndRoles(uid), 0);
      } else {
        setRoles([]);
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        loadProfileAndRoles(existing.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [loadProfileAndRoles]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    try {
      const p = await getMyProfile(user.id);
      setProfile(p);
    } catch {
      // ignore
    }
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      roles,
      profile,
      loading,
      isAdmin: roles.includes("admin"),
      refreshProfile,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error as Error | null };
      },
      signUp: async (email, password, meta) => {
        const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo, data: meta },
        });
        return { error: error as Error | null };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, user, roles, profile, loading, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
