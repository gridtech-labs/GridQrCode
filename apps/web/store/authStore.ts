import { create } from "zustand";
import { persist } from "zustand/middleware";
import api, { setAccessToken, getAccessToken } from "../lib/api";
import type { AuthUser, LoginDto, RegisterDto } from "@qr-saas/shared";

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  _hasHydrated: boolean;

  login: (credentials: LoginDto) => Promise<void>;
  register: (data: RegisterDto) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  clearError: () => void;
  setHasHydrated: (v: boolean) => void;
}

function setAuthCookie() {
  if (typeof document !== "undefined") {
    document.cookie = "qr-auth-status=1; path=/; max-age=2592000; SameSite=Lax";
  }
}
function clearAuthCookie() {
  if (typeof document !== "undefined") {
    document.cookie = "qr-auth-status=; path=/; max-age=0";
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      _hasHydrated: false,

      setHasHydrated: (v) => set({ _hasHydrated: v }),

      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post<{
            data: { user: AuthUser; accessToken: string; expiresIn: number };
          }>("/auth/login", credentials);
          setAccessToken(data.data.accessToken);
          setAuthCookie();
          set({ user: data.data.user, isAuthenticated: true, isLoading: false });
        } catch (err: unknown) {
          const message =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            "Login failed";
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      register: async (payload) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post<{
            data: { user: AuthUser; accessToken: string; expiresIn: number };
          }>("/auth/register", payload);
          setAccessToken(data.data.accessToken);
          setAuthCookie();
          set({ user: data.data.user, isAuthenticated: true, isLoading: false });
        } catch (err: unknown) {
          const message =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            "Registration failed";
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      logout: async () => {
        try { await api.post("/auth/logout"); } catch { /* ignore */ }
        setAccessToken(null);
        clearAuthCookie();
        set({ user: null, isAuthenticated: false, error: null });
      },

      fetchMe: async () => {
        if (!get().isAuthenticated) return;
        try {
          const { data } = await api.get<{ data: { user: AuthUser } }>("/auth/me");
          set({ user: data.data.user });
        } catch {
          // Only clear auth if there is truly no token anywhere —
          // a 401 here is usually a stale access token; the axios interceptor
          // will refresh it automatically on the next real request.
          if (!getAccessToken()) {
            clearAuthCookie();
            setAccessToken(null);
            set({ user: null, isAuthenticated: false });
          }
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "qr-auth",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        // CRITICAL: Restore the in-memory access token from localStorage immediately
        // when the Zustand store rehydrates. Without this, the axios interceptor
        // cannot attach the token on the first batch of requests that fire right
        // after a page refresh — causing 401 on /restaurant, /auth/me, /tables etc.
        if (typeof window !== "undefined") {
          const storedToken = localStorage.getItem("at");
          if (storedToken) {
            setAccessToken(storedToken);
          }
        }
        state?.setHasHydrated(true);
      },
    }
  )
);
