import { create } from "zustand";
import type { CartItem, CartModification, MenuItem } from "@qr-saas/shared";

interface CartState {
  items: CartItem[];
  restaurantId: string | null;
  sessionToken: string | null;

  setSession: (restaurantId: string, sessionToken: string) => void;
  addItem: (menuItem: MenuItem, quantity?: number, modifications?: CartModification[], notes?: string) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  clearCart: () => void;

  // Derived
  totalItems: () => number;
  subtotal: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  restaurantId: null,
  sessionToken: null,

  setSession: (restaurantId, sessionToken) =>
    set({ restaurantId, sessionToken }),

  addItem: (menuItem, quantity = 1, modifications = [], notes = "") => {
    const modTotal = modifications.reduce((sum, m) => sum + m.priceDelta, 0);
    const unitPrice = menuItem.price + modTotal;

    set((state) => {
      // Check if identical item+mods already in cart
      const existing = state.items.find(
        (i) => i.menuItemId === menuItem.id &&
          JSON.stringify(i.modifications) === JSON.stringify(modifications)
      );

      if (existing) {
        return {
          items: state.items.map((i) =>
            i === existing
              ? { ...i, quantity: i.quantity + quantity, lineTotal: (i.quantity + quantity) * unitPrice }
              : i
          ),
        };
      }

      const newItem: CartItem = {
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        imageUrl: menuItem.imageUrl,
        quantity,
        modifications,
        notes,
        lineTotal: unitPrice * quantity,
      };
      return { items: [...state.items, newItem] };
    });
  },

  removeItem: (menuItemId) =>
    set((state) => ({ items: state.items.filter((i) => i.menuItemId !== menuItemId) })),

  updateQuantity: (menuItemId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(menuItemId);
      return;
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.menuItemId === menuItemId
          ? { ...i, quantity, lineTotal: (i.price + i.modifications.reduce((s, m) => s + m.priceDelta, 0)) * quantity }
          : i
      ),
    }));
  },

  clearCart: () => set({ items: [] }),

  totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
  subtotal:   () => get().items.reduce((sum, i) => sum + i.lineTotal, 0),
}));
