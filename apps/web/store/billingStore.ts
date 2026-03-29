import { create } from "zustand";
import api from "../lib/api";
import type { Plan, Subscription, UsageStats, BillingRecord } from "@qr-saas/shared";

interface BillingState {
  plans: Plan[];
  subscription: Subscription | null;
  usage: UsageStats | null;
  history: BillingRecord[];
  isLoading: boolean;
  error: string | null;

  fetchPlans: () => Promise<void>;
  fetchSubscription: () => Promise<void>;
  fetchUsage: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  changePlan: (planId: string, billingCycle: "monthly" | "yearly") => Promise<void>;

  fetchAll: () => Promise<void>;
}

export const useBillingStore = create<BillingState>((set, get) => ({
  plans: [],
  subscription: null,
  usage: null,
  history: [],
  isLoading: false,
  error: null,

  fetchPlans: async () => {
    const { data } = await api.get<{ data: { plans: Plan[] } }>("/billing/plans");
    set({ plans: data.data.plans });
  },

  fetchSubscription: async () => {
    const { data } = await api.get<{ data: { subscription: Subscription | null } }>("/billing/subscription");
    set({ subscription: data.data.subscription });
  },

  fetchUsage: async () => {
    const { data } = await api.get<{ data: { usage: UsageStats } }>("/billing/usage");
    set({ usage: data.data.usage });
  },

  fetchHistory: async () => {
    const { data } = await api.get<{ data: { history: BillingRecord[] } }>("/billing/history");
    set({ history: data.data.history });
  },

  changePlan: async (planId, billingCycle) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post<{ data: { subscription: Subscription } }>(
        "/billing/change-plan",
        { planId, billingCycle }
      );
      set({ subscription: data.data.subscription, isLoading: false });
      // Refresh usage after plan change
      await get().fetchUsage();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to change plan";
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  fetchAll: async () => {
    set({ isLoading: true });
    try {
      await Promise.all([
        get().fetchPlans(),
        get().fetchSubscription(),
        get().fetchUsage(),
        get().fetchHistory(),
      ]);
    } finally {
      set({ isLoading: false });
    }
  },
}));
