import { create } from "zustand";
import api from "../lib/api";
import type { Order, OrderItemStatus, KitchenStats } from "@qr-saas/shared";
import { SOCKET_EVENTS } from "@qr-saas/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface KitchenState {
  orders: Order[];
  stats: KitchenStats | null;
  isLoading: boolean;
  connected: boolean;

  fetchOrders: () => Promise<void>;
  fetchStats: () => Promise<void>;
  updateItemStatus: (orderId: string, itemId: string, status: OrderItemStatus) => Promise<void>;
  bumpOrder: (orderId: string) => Promise<void>;

  // Real-time
  upsertOrder: (order: Order) => void;
  removeOrder: (orderId: string) => void;
  setConnected: (v: boolean) => void;
}

export const useKitchenStore = create<KitchenState>((set, get) => ({
  orders: [],
  stats: null,
  isLoading: false,
  connected: false,

  fetchOrders: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get<{ data: { orders: Order[] } }>("/kitchen/orders");
      set({ orders: data.data.orders, isLoading: false });
    } catch { set({ isLoading: false }); }
  },

  fetchStats: async () => {
    try {
      const { data } = await api.get<{ data: { stats: KitchenStats } }>("/kitchen/stats");
      set({ stats: data.data.stats });
    } catch { /* non-fatal */ }
  },

  updateItemStatus: async (orderId, itemId, status) => {
    const { data } = await api.patch<{ data: { order: Order } }>(
      `/kitchen/orders/${orderId}/items/${itemId}`,
      { status }
    );
    get().upsertOrder(data.data.order);
  },

  bumpOrder: async (orderId) => {
    const { data } = await api.patch<{ data: { order: Order } }>(
      `/kitchen/orders/${orderId}/bump`
    );
    get().upsertOrder(data.data.order);
  },

  upsertOrder: (order) => {
    // Remove from KDS if order is served or cancelled
    if (["served", "cancelled"].includes(order.status)) {
      get().removeOrder(order.id);
      return;
    }
    set((s) => {
      const exists = s.orders.find((o) => o.id === order.id);
      return {
        orders: exists
          ? s.orders.map((o) => (o.id === order.id ? order : o))
          : [...s.orders, order].sort(
              (a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime()
            ),
      };
    });
  },

  removeOrder: (orderId) =>
    set((s) => ({ orders: s.orders.filter((o) => o.id !== orderId) })),

  setConnected: (v) => set({ connected: v }),
}));

// ── Socket.io hook — call once from the KDS page ──────────────

let _socket: ReturnType<typeof import("socket.io-client").io> | null = null;

export function connectKitchenSocket(restaurantId: string) {
  if (_socket?.connected) return _socket;

  // Dynamic import to avoid SSR issues
  import("socket.io-client").then(({ io }) => {
    _socket = io(API_URL, { transports: ["websocket", "polling"] });

    _socket.on("connect", () => {
      _socket!.emit(SOCKET_EVENTS.JOIN_KITCHEN, restaurantId);
      useKitchenStore.getState().setConnected(true);
    });

    _socket.on("disconnect", () => {
      useKitchenStore.getState().setConnected(false);
    });

    _socket.on(SOCKET_EVENTS.ORDER_NEW, (order: Order) => {
      useKitchenStore.getState().upsertOrder(order);
      useKitchenStore.getState().fetchStats();
      // Play sound if browser supports it
      try {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      } catch { /* audio not available */ }
    });

    _socket.on(SOCKET_EVENTS.ORDER_UPDATED, (order: Order) => {
      useKitchenStore.getState().upsertOrder(order);
    });
  });

  return _socket;
}

export function disconnectKitchenSocket() {
  _socket?.disconnect();
  _socket = null;
}
