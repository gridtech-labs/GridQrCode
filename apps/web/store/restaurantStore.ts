import { create } from "zustand";
import api from "../lib/api";
import type { Restaurant, UpdateRestaurantDto } from "@qr-saas/shared";

interface RestaurantState {
  restaurant: Restaurant | null;
  isLoading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  update: (dto: UpdateRestaurantDto) => Promise<void>;
  uploadLogo: (file: File) => Promise<string>;
  uploadCover: (file: File) => Promise<string>;
}

export const useRestaurantStore = create<RestaurantState>((set, get) => ({
  restaurant: null,
  isLoading: false,
  error: null,

  fetch: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get<{ data: { restaurant: Restaurant } }>("/restaurant");
      set({ restaurant: data.data.restaurant, isLoading: false });
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to load restaurant";
      set({ error: message, isLoading: false });
    }
  },

  update: async (dto) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.patch<{ data: { restaurant: Restaurant } }>("/restaurant", dto);
      set({ restaurant: data.data.restaurant, isLoading: false });
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to update";
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  uploadLogo: async (file) => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await api.post<{ data: { url: string } }>("/restaurant/logo", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    set((s) => ({ restaurant: s.restaurant ? { ...s.restaurant, logoUrl: data.data.url } : s.restaurant }));
    return data.data.url;
  },

  uploadCover: async (file) => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await api.post<{ data: { url: string } }>("/restaurant/cover", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    set((s) => ({ restaurant: s.restaurant ? { ...s.restaurant, coverUrl: data.data.url } : s.restaurant }));
    return data.data.url;
  },
}));
