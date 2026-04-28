"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { readAppRoleFromMetadata, type AppRole } from "@/lib/auth/app-role";
import { getBrowserSupabaseClient, hasSupabasePublicEnv } from "@/lib/supabase/client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type SignInResult =
  | { ok: true; role: AppRole; message?: string; needsEmailConfirmation?: boolean }
  | { ok: false; message: string };

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  fullName: string;
  isBootstrapping: boolean;
  isRefreshing: boolean;
  refreshProfile: () => Promise<AppRole | null>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signUp: (email: string, password: string) => Promise<SignInResult>;
  signInWithFacebook: (redirectTo: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function roleFromUser(user: User | null): AppRole | null {
  if (!user) {
    return null;
  }
  return readAppRoleFromMetadata(user.app_metadata, user.user_metadata);
}

async function fetchProfileRole(session: Session): Promise<{ role: AppRole; fullName: string } | null> {
  const response = await fetch("/api/auth/me", {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(`AUTH_${response.status}`);
  }

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    data?: {
      role?: AppRole;
      fullName?: string;
    };
  };

  const role = payload.data?.role;
  if (role !== "admin" && role !== "seller" && role !== "user") {
    return null;
  }

  return {
    role,
    fullName: payload.data?.fullName ?? "",
  };
}

type ProfileFetchResult =
  | { kind: "ok"; role: AppRole; fullName: string }
  | { kind: "unauthorized" }
  | { kind: "error" };

async function resolveProfileRole(session: Session): Promise<ProfileFetchResult> {
  try {
    const profile = await fetchProfileRole(session);
    if (!profile) {
      return { kind: "error" };
    }
    return { kind: "ok", ...profile };
  } catch (error) {
    if (
      error instanceof Error &&
      /AUTH_401|AUTH_403|not authenticated|unauthorized/i.test(error.message)
    ) {
      return { kind: "unauthorized" };
    }
    return { kind: "error" };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [role, setRole] = useState<AppRole | null>(null);
  const [fullName, setFullName] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMountedRef = useRef(true);
  const requestVersionRef = useRef(0);
  const statusRef = useRef<AuthStatus>("loading");
  const roleRef = useRef<AppRole | null>(null);
  const fullNameRef = useRef("");

  const commitStatus = useCallback((nextStatus: AuthStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  const commitRole = useCallback((nextRole: AppRole | null) => {
    roleRef.current = nextRole;
    setRole(nextRole);
  }, []);

  const commitFullName = useCallback((nextFullName: string) => {
    fullNameRef.current = nextFullName;
    setFullName(nextFullName);
  }, []);

  const clearAuthState = useCallback(() => {
    setSession(null);
    commitRole(null);
    commitFullName("");
    commitStatus("unauthenticated");
    setIsBootstrapping(false);
    setIsRefreshing(false);
  }, [commitFullName, commitRole, commitStatus]);

  const applySession = useCallback(
    async (
      nextSession: Session | null,
      options: { isBootstrapping?: boolean; syncClientSignOut?: boolean } = {}
    ): Promise<AppRole | null> => {
      const shouldBootstrap = options.isBootstrapping ?? false;
      const shouldSyncClientSignOut = options.syncClientSignOut ?? false;
      const requestVersion = ++requestVersionRef.current;

      if (!nextSession) {
        if (!isMountedRef.current || requestVersion !== requestVersionRef.current) {
          return null;
        }
        clearAuthState();
        return null;
      }

      setSession(nextSession);

      if (shouldBootstrap || statusRef.current !== "authenticated") {
        setIsBootstrapping(true);
        setIsRefreshing(false);
        commitStatus("loading");
      } else {
        setIsRefreshing(true);
      }

      const profileResult = await resolveProfileRole(nextSession);

      if (!isMountedRef.current || requestVersion !== requestVersionRef.current) {
        return roleRef.current;
      }

      if (profileResult.kind === "unauthorized") {
        clearAuthState();

        if (shouldSyncClientSignOut && hasSupabasePublicEnv()) {
          void getBrowserSupabaseClient().auth.signOut().catch(() => undefined);
        }

        return null;
      }

      const nextRole =
        profileResult.kind === "ok"
          ? profileResult.role
          : roleRef.current ?? roleFromUser(nextSession.user) ?? "user";
      const nextFullName =
        profileResult.kind === "ok" ? profileResult.fullName : fullNameRef.current;

      commitRole(nextRole);
      commitFullName(nextFullName);
      commitStatus("authenticated");
      setIsBootstrapping(false);
      setIsRefreshing(false);
      return nextRole;
    },
    [clearAuthState, commitFullName, commitRole, commitStatus]
  );

  useEffect(() => {
    isMountedRef.current = true;

    if (!hasSupabasePublicEnv()) {
      clearAuthState();
      return;
    }

    const supabase = getBrowserSupabaseClient();

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        await applySession(data.session ?? null, { isBootstrapping: true });
      })
      .catch(() => {
        if (!isMountedRef.current) {
          return;
        }
        clearAuthState();
      });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "INITIAL_SESSION") {
        return;
      }

      if (event === "SIGNED_OUT") {
        void applySession(null);
        return;
      }

      void applySession(nextSession, { syncClientSignOut: true });
    });

    return () => {
      isMountedRef.current = false;
      data.subscription.unsubscribe();
    };
  }, [applySession, clearAuthState]);

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    if (!hasSupabasePublicEnv()) {
      return {
        ok: false,
        message: "Supabase public URL and publishable key are required for login.",
      };
    }

    const supabase = getBrowserSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    const nextSession = data.session ?? null;
    const nextRole = await applySession(nextSession);

    return { ok: true, role: nextRole ?? roleFromUser(data.user) ?? "user" };
  }, [applySession]);

  const signUp = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    if (!hasSupabasePublicEnv()) {
      return {
        ok: false,
        message: "Supabase public URL and publishable key are required for signup.",
      };
    }

    const supabase = getBrowserSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    if (!data.session) {
      await applySession(null);
      return {
        ok: true,
        role: "user",
        needsEmailConfirmation: true,
        message: "Check your email to confirm the account, then sign in.",
      };
    }

    const nextRole = await applySession(data.session);
    return { ok: true, role: nextRole ?? "user" };
  }, [applySession]);

  const signInWithFacebook = useCallback(async (redirectTo: string): Promise<SignInResult> => {
    if (!hasSupabasePublicEnv()) {
      return {
        ok: false,
        message: "Supabase public URL and publishable key are required for Facebook login.",
      };
    }

    const { error } = await getBrowserSupabaseClient().auth.signInWithOAuth({
      provider: "facebook",
      options: {
        redirectTo,
      },
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    return { ok: true, role: "user" };
  }, []);

  const refreshProfile = useCallback(async (): Promise<AppRole | null> => {
    return applySession(session, { syncClientSignOut: true });
  }, [applySession, session]);

  const signOut = useCallback(async () => {
    if (hasSupabasePublicEnv()) {
      await getBrowserSupabaseClient().auth.signOut();
    }
    await applySession(null);
  }, [applySession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      role,
      fullName,
      isBootstrapping,
      isRefreshing,
      refreshProfile,
      signIn,
      signUp,
      signInWithFacebook,
      signOut,
    }),
    [
      fullName,
      isBootstrapping,
      isRefreshing,
      refreshProfile,
      role,
      session,
      signIn,
      signInWithFacebook,
      signOut,
      signUp,
      status,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
