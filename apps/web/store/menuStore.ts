import { create } from "zustand";
import api from "../lib/api";
import type {
  MenuCategory,
  MenuItem,
  Modifier,
  CreateMenuCategoryDto,
  UpdateMenuCategoryDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
  CreateModifierDto,
} from "@qr-saas/shared";

interface MenuState {
  categories: MenuCategory[];
  items: MenuItem[];
  modifiers: Modifier[];
  isLoading: boolean;
  error: string | null;

  fetchCategories: () => Promise<void>;
  createCategory: (dto: CreateMenuCategoryDto) => Promise<MenuCategory>;
  updateCategory: (id: string, dto: UpdateMenuCategoryDto) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  fetchItems: (opts?: { categoryId?: string; search?: string }) => Promise<void>;
  createItem: (dto: CreateMenuItemDto) => Promise<MenuItem>;
  updateItem: (id: string, dto: UpdateMenuItemDto) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  toggleItem: (id: string) => Promise<void>;
  uploadItemImage: (id: string, file: File) => Promise<string>;

  fetchModifiers: () => Promise<void>;
  createModifier: (dto: CreateModifierDto) => Promise<Modifier>;
  deleteModifier: (id: string) => Promise<void>;
}

export const useMenuStore = create<MenuState>((set) => ({
  categories: [],
  items: [],
  modifiers: [],
  isLoading: false,
  error: null,

  // ── Categories ────────────────────────────────────────────────

  fetchCategories: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get<{ data: { categories: MenuCategory[] } }>("/menu/categories");
      set({ categories: data.data.categories, isLoading: false });
    } catch { set({ isLoading: false }); }
  },

  createCategory: async (dto) => {
    const { data } = await api.post<{ data: { category: MenuCategory } }>("/menu/categories", dto);
    set((s) => ({ categories: [...s.categories, data.data.category] }));
    return data.data.category;
  },

  updateCategory: async (id, dto) => {
    const { data } = await api.patch<{ data: { category: MenuCategory } }>(`/menu/categories/${id}`, dto);
    set((s) => ({
      categories: s.categories.map((c) => (c.id === id ? data.data.category : c)),
    }));
  },

  deleteCategory: async (id) => {
    await api.delete(`/menu/categories/${id}`);
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));
  },

  // ── Items ─────────────────────────────────────────────────────

  fetchItems: async (opts = {}) => {
    set({ isLoading: true });
    try {
      const params = new URLSearchParams();
      if (opts.categoryId) params.set("categoryId", opts.categoryId);
      if (opts.search) params.set("search", opts.search);
      const { data } = await api.get<{ data: { items: MenuItem[] } }>(`/menu/items?${params}`);
      set({ items: data.data.items, isLoading: false });
    } catch { set({ isLoading: false }); }
  },

  createItem: async (dto) => {
    const { data } = await api.post<{ data: { item: MenuItem } }>("/menu/items", dto);
    set((s) => ({ items: [...s.items, data.data.item] }));
    return data.data.item;
  },

  updateItem: async (id, dto) => {
    const { data } = await api.patch<{ data: { item: MenuItem } }>(`/menu/items/${id}`, dto);
    set((s) => ({ items: s.items.map((i) => (i.id === id ? data.data.item : i)) }));
  },

  deleteItem: async (id) => {
    await api.delete(`/menu/items/${id}`);
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  toggleItem: async (id) => {
    const { data } = await api.post<{ data: { item: MenuItem } }>(`/menu/items/${id}/toggle`);
    set((s) => ({ items: s.items.map((i) => (i.id === id ? data.data.item : i)) }));
  },

  uploadItemImage: async (id, file) => {
    const form = new FormData();
    form.append("file", file);
    const { data } = await api.post<{ data: { url: string } }>(`/menu/items/${id}/image`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, imageUrl: data.data.url } : i)),
    }));
    return data.data.url;
  },

  // ── Modifiers ─────────────────────────────────────────────────

  fetchModifiers: async () => {
    const { data } = await api.get<{ data: { modifiers: Modifier[] } }>("/menu/modifiers");
    set({ modifiers: data.data.modifiers });
  },

  createModifier: async (dto) => {
    const { data } = await api.post<{ data: { modifier: Modifier } }>("/menu/modifiers", dto);
    set((s) => ({ modifiers: [...s.modifiers, data.data.modifier] }));
    return data.data.modifier;
  },

  deleteModifier: async (id) => {
    await api.delete(`/menu/modifiers/${id}`);
    set((s) => ({ modifiers: s.modifiers.filter((m) => m.id !== id) }));
  },
}));
