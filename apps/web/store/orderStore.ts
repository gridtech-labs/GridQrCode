import { create } from "zustand";
import api from "../lib/api";
import type { Order, OrderStatus } from "@qr-saas/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface OrderState {
  orders: Order[];
  total: number;
  isLoading: boolean;
  stats: { totalOrders: number; pendingOrders: number; totalRevenue: number; avgOrderValue: number } | null;

  // Staff
  fetchOrders: (status?: string) => Promise<void>;
  fetchStats: () => Promise<void>;
  updateStatus: (orderId: string, status: OrderStatus) => Promise<void>;

  // Diner
  dinerOrders: Order[];
  placeDinerOrder: (restaurantId: string, sessionToken: string, items: Array<{ menuItemId: string; quantity: number; notes?: string }>, orderNotes?: string) => Promise<Order>;
  fetchDinerOrders: (restaurantId: string, sessionToken: string) => Promise<void>;

  // Real-time update
  upsertOrder: (order: Order) => void;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  total: 0,
  isLoading: false,
  stats: null,
  dinerOrders: [],

  fetchOrders: async (status) => {
    set({ isLoading: true });
    try {
      const params = status && status !== "all" ? `?status=${status}` : "";
      const { data } = await api.get<{ data: { orders: Order[]; total: number } }>(`/orders${params}`);
      set({ orders: data.data.orders, total: data.data.total, isLoading: false });
    } catch { set({ isLoading: false }); }
  },

  fetchStats: async () => {
    try {
      const { data } = await api.get<{ data: { stats: OrderState["stats"] } }>("/orders/stats");
      set({ stats: data.data.stats });
    } catch { /* non-fatal */ }
  },

  updateStatus: async (orderId, status) => {
    const { data } = await api.patch<{ data: { order: Order } }>(`/orders/${orderId}/status`, { status });
    set((s) => ({
      orders: s.orders.map((o) => (o.id === orderId ? data.data.order : o)),
    }));
  },

  placeDinerOrder: async (restaurantId, sessionToken, items, orderNotes) => {
    const resp = await fetch(`${API_URL}/api/v1/diner/${restaurantId}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionToken, items, notes: orderNotes }),
    });
    const json = await resp.json();
    if (!json.success) throw new Error(json.message ?? "Failed to place order");
    const order: Order = json.data.order;
    set((s) => ({ dinerOrders: [...s.dinerOrders, order] }));
    return order;
  },

  fetchDinerOrders: async (restaurantId, sessionToken) => {
    try {
      const resp = await fetch(`${API_URL}/api/v1/diner/${restaurantId}/orders/${sessionToken}`);
      const json = await resp.json();
      if (json.success) set({ dinerOrders: json.data.orders });
    } catch { /* non-fatal */ }
  },

  upsertOrder: (order) => {
    set((s) => {
      const exists = s.orders.find((o) => o.id === order.id);
      return {
        orders: exists
          ? s.orders.map((o) => (o.id === order.id ? order : o))
          : [order, ...s.orders],
        dinerOrders: s.dinerOrders.map((o) => (o.id === order.id ? order : o)),
      };
    });
  },
}));
