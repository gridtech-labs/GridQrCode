"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import type { DinerScanResult, MenuItem } from "@qr-saas/shared";
import { useCartStore } from "../../../../store/cartStore";
import { useOrderStore } from "../../../../store/orderStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ── Status colours ────────────────────────────────────────────
const ORDER_STATUS_CONFIG = {
  pending:    { label: "Order received",  icon: "🕐", color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-200" },
  confirmed:  { label: "Confirmed",       icon: "✅", color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200" },
  preparing:  { label: "Being prepared",  icon: "👨‍🍳", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
  ready:      { label: "Ready to serve!", icon: "🔔", color: "text-green-600",  bg: "bg-green-50",  border: "border-green-200" },
  served:     { label: "Served",          icon: "🍽️", color: "text-slate-600",  bg: "bg-slate-50",  border: "border-slate-200" },
  cancelled:  { label: "Cancelled",       icon: "✕",  color: "text-red-600",    bg: "bg-red-50",    border: "border-red-200"   },
} as const;

// ── Skeleton ──────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-44 bg-slate-200 animate-pulse" />
      <div className="max-w-2xl mx-auto px-4 pt-14 space-y-3">
        {[...Array(5)].map((_, i) => <div key={i} className="bg-white rounded-2xl h-24 animate-pulse" />)}
      </div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-2xl bg-red-100 flex items-center justify-center text-4xl mx-auto mb-5">🔗</div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Table Not Found</h2>
        <p className="text-sm text-slate-500">{message}</p>
      </div>
    </div>
  );
}

// ── Cart Drawer ───────────────────────────────────────────────
function CartDrawer({ open, onClose, restaurantId, sessionToken, currency, onOrderPlaced }: {
  open: boolean; onClose: () => void;
  restaurantId: string; sessionToken: string;
  currency: string; onOrderPlaced: () => void;
}) {
  const { items, subtotal, updateQuantity, removeItem, clearCart, totalItems } = useCartStore();
  const { placeDinerOrder } = useOrderStore();
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");

  const symbols: Record<string, string> = { USD:"$", EUR:"€", GBP:"£", INR:"₹", AED:"د.إ", CAD:"CA$", AUD:"A$", SGD:"S$", JPY:"¥" };
  const sym = symbols[currency] ?? currency + " ";

  const placeOrder = async () => {
    if (!items.length) return;
    setPlacing(true); setError("");
    try {
      await placeDinerOrder(
        restaurantId,
        sessionToken,
        items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity, notes: i.notes || undefined })),
        notes || undefined
      );
      clearCart();
      setNotes("");
      onOrderPlaced();
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message ?? "Failed to place order. Please try again.");
    } finally { setPlacing(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Your order</h3>
            <p className="text-xs text-slate-400">{totalItems()} item{totalItems() !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">✕</button>
        </div>

        {/* Items */}
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-3">
          {items.map((item) => (
            <div key={item.menuItemId} className="flex items-center gap-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm truncate">{item.name}</p>
                {item.notes && <p className="text-xs text-slate-400 truncate">{item.notes}</p>}
                <p className="text-sm font-semibold text-indigo-600 mt-0.5">{sym}{item.lineTotal.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => updateQuantity(item.menuItemId, item.quantity - 1)}
                  className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 font-bold text-lg leading-none">−</button>
                <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                  className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 hover:bg-indigo-200 font-bold text-lg leading-none">+</button>
                <button onClick={() => removeItem(item.menuItemId)}
                  className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 text-xs ml-1">🗑️</button>
              </div>
            </div>
          ))}

          {/* Notes */}
          <div className="pt-2">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Order notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any special requests for the whole order?"
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 bg-white rounded-b-3xl sm:rounded-b-2xl">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl mb-3">{error}</p>}
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-600 font-medium">Subtotal</span>
            <span className="text-xl font-bold text-slate-900">{sym}{subtotal().toFixed(2)}</span>
          </div>
          <button
            onClick={placeOrder}
            disabled={placing || !items.length}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-base transition"
          >
            {placing ? "Placing order…" : `Place order · ${sym}${subtotal().toFixed(2)}`}
          </button>
          <p className="text-xs text-slate-400 text-center mt-2">Pay at the counter or ask your server</p>
        </div>
      </div>
    </div>
  );
}

// ── Order tracker panel ───────────────────────────────────────
function OrderTracker({ restaurantId, sessionToken }: { restaurantId: string; sessionToken: string }) {
  const { dinerOrders, fetchDinerOrders } = useOrderStore();

  useEffect(() => {
    fetchDinerOrders(restaurantId, sessionToken);
    const interval = setInterval(() => fetchDinerOrders(restaurantId, sessionToken), 15000);
    return () => clearInterval(interval);
  }, [restaurantId, sessionToken, fetchDinerOrders]);

  const activeOrders = dinerOrders.filter(o => !["served", "cancelled"].includes(o.status));
  if (!dinerOrders.length) return null;

  return (
    <div className="fixed top-4 right-4 z-40 w-64 space-y-2">
      {activeOrders.map(order => {
        const cfg = ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG] ?? ORDER_STATUS_CONFIG.pending;
        return (
          <div key={order.id} className={`rounded-2xl border ${cfg.border} ${cfg.bg} p-3 shadow-lg`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{cfg.icon}</span>
              <div className="min-w-0">
                <p className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</p>
                <p className="text-xs text-slate-400">Order #{order.orderNumber}</p>
              </div>
            </div>
            <div className="flex gap-1 mt-1.5">
              {(["pending","confirmed","preparing","ready"] as const).map((s, i) => {
                const statuses = ["pending","confirmed","preparing","ready","served"];
                const currentIdx = statuses.indexOf(order.status);
                const done = i <= currentIdx - 1;
                const active = i === currentIdx;
                return (
                  <div key={s} className={`flex-1 h-1 rounded-full ${done ? "bg-green-400" : active ? "bg-indigo-500" : "bg-slate-200"}`} />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Item card ─────────────────────────────────────────────────
function ItemCard({ item, currency, onAdd }: { item: MenuItem; currency: string; onAdd: (item: MenuItem) => void }) {
  const [expanded, setExpanded] = useState(false);
  const cartItems = useCartStore(s => s.items);
  const inCart = cartItems.find(i => i.menuItemId === item.id);

  const symbols: Record<string, string> = { USD:"$", EUR:"€", GBP:"£", INR:"₹", AED:"د.إ", CAD:"CA$", AUD:"A$", SGD:"S$", JPY:"¥" };
  const sym = symbols[currency] ?? currency + " ";

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      <div className="flex gap-3 p-4 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{item.name}</p>
              {item.isFeatured && (
                <span className="inline-flex items-center text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full mt-1">⭐ Featured</span>
              )}
            </div>
            <p className="font-bold text-slate-900 shrink-0 text-sm">{sym}{Number(item.price).toFixed(2)}</p>
          </div>
          {item.description && (
            <p className={`text-sm text-slate-500 mt-1.5 ${expanded ? "" : "line-clamp-2"}`}>{item.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
            {item.prepTimeMin > 0 && <span className="text-xs text-slate-400">⏱ {item.prepTimeMin} min</span>}
            {item.calories && <span className="text-xs text-slate-400">🔥 {item.calories} cal</span>}
            {item.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100">{tag}</span>
            ))}
          </div>
          {item.allergens.length > 0 && expanded && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.allergens.map(a => (
                <span key={a} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">{a}</span>
              ))}
            </div>
          )}
        </div>

        {item.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={item.name} className="w-20 h-20 rounded-xl object-cover shrink-0 self-start" />
        )}
      </div>

      {/* Add to cart row */}
      <div className="px-4 pb-4 flex items-center justify-between">
        {inCart ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => useCartStore.getState().updateQuantity(item.id, inCart.quantity - 1)}
              className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-lg hover:bg-slate-200">−</button>
            <span className="font-semibold text-slate-900 w-4 text-center">{inCart.quantity}</span>
            <button
              onClick={() => useCartStore.getState().updateQuantity(item.id, inCart.quantity + 1)}
              className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-lg hover:bg-indigo-700">+</button>
          </div>
        ) : (
          <button
            onClick={() => onAdd(item)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition active:scale-95">
            <span className="text-base">+</span> Add
          </button>
        )}
        <span className="text-xs text-slate-400">{sym}{Number(item.price).toFixed(2)}</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function DinerPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<DinerScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderPlacedMsg, setOrderPlacedMsg] = useState(false);

  const { setSession, totalItems } = useCartStore();
  const cartCount = useCartStore(s => s.totalItems());

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/v1/diner/scan/${token}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          const result = json.data as DinerScanResult;
          setData(result);
          setSession(result.restaurant.id, result.session.sessionToken);
        } else {
          setError(json.message ?? "This QR code is not valid.");
        }
      })
      .catch(() => setError("Could not connect. Please try again."))
      .finally(() => setLoading(false));
  }, [token, setSession]);

  const handleOrderPlaced = useCallback(() => {
    setOrderPlacedMsg(true);
    setTimeout(() => setOrderPlacedMsg(false), 4000);
  }, []);

  if (loading) return <Skeleton />;
  if (error || !data) return <ErrorScreen message={error ?? "Unknown error"} />;

  const { restaurant, table, menu } = data;
  const { categories, items } = menu;
  const featuredItems = items.filter(i => i.isFeatured);

  const displayItems = activeCategory
    ? items.filter(i => i.categoryId === activeCategory)
    : items;

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Order tracker (top-right corner badges) */}
      <OrderTracker restaurantId={restaurant.id} sessionToken={data.session.sessionToken} />

      {/* Order placed toast */}
      {orderPlacedMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-5 py-3 rounded-2xl shadow-xl text-sm font-medium flex items-center gap-2 animate-bounce">
          ✅ Order placed! We&apos;ll get started right away.
        </div>
      )}

      {/* Cover */}
      <div className="relative">
        {restaurant.coverUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={restaurant.coverUrl} alt="" className="w-full h-44 object-cover" />
          : <div className="w-full h-44 bg-gradient-to-br from-indigo-600 to-purple-700" />
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 left-4 translate-y-1/2">
          {restaurant.logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={restaurant.logoUrl} alt="" className="w-16 h-16 rounded-2xl border-4 border-white shadow-lg object-cover" />
            : <div className="w-16 h-16 rounded-2xl border-4 border-white shadow-lg bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold">{restaurant.name[0]}</div>
          }
        </div>
        {table && (
          <div className="absolute bottom-3 right-4">
            <div className="bg-white/90 backdrop-blur rounded-xl px-3 py-2 text-center shadow">
              <p className="text-xs text-slate-400">Table</p>
              <p className="text-xl font-black text-slate-900 leading-tight">{table.number}</p>
            </div>
          </div>
        )}
      </div>

      {/* Restaurant info */}
      <div className="max-w-2xl mx-auto px-4 pt-12 pb-3">
        <h1 className="text-xl font-bold text-slate-900">{restaurant.name}</h1>
        {restaurant.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{restaurant.description}</p>}
      </div>

      <div className="max-w-2xl mx-auto px-4 space-y-4">
        {/* Featured */}
        {featuredItems.length > 0 && !activeCategory && (
          <section>
            <h2 className="font-semibold text-slate-900 mb-3">⭐ Featured</h2>
            <div className="space-y-3">
              {featuredItems.map(item => (
                <ItemCard key={item.id} item={item} currency={restaurant.currency}
                  onAdd={(mi) => { useCartStore.getState().addItem(mi); }} />
              ))}
            </div>
          </section>
        )}

        {/* Category tabs */}
        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            <button onClick={() => setActiveCategory(null)}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition ${activeCategory === null ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
              All
            </button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition ${activeCategory === cat.id ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Items */}
        {activeCategory ? (
          <section>
            <h2 className="font-semibold text-slate-900 mb-3">{categories.find(c => c.id === activeCategory)?.name}</h2>
            <div className="space-y-3">
              {displayItems.length === 0
                ? <p className="text-sm text-slate-400 text-center py-8">No items in this category.</p>
                : displayItems.map(item => (
                    <ItemCard key={item.id} item={item} currency={restaurant.currency}
                      onAdd={(mi) => useCartStore.getState().addItem(mi)} />
                  ))}
            </div>
          </section>
        ) : (
          <>
            {categories.map(cat => {
              const catItems = items.filter(i => i.categoryId === cat.id);
              if (!catItems.length) return null;
              return (
                <section key={cat.id}>
                  <h2 className="font-semibold text-slate-900 mb-3">{cat.name}
                    <span className="text-xs text-slate-400 font-normal ml-2">{catItems.length} items</span>
                  </h2>
                  <div className="space-y-3">
                    {catItems.map(item => (
                      <ItemCard key={item.id} item={item} currency={restaurant.currency}
                        onAdd={(mi) => useCartStore.getState().addItem(mi)} />
                    ))}
                  </div>
                </section>
              );
            })}
            {(() => {
              const uncatItems = items.filter(i => !i.categoryId);
              if (!uncatItems.length) return null;
              return (
                <section>
                  <h2 className="font-semibold text-slate-900 mb-3">Other</h2>
                  <div className="space-y-3">
                    {uncatItems.map(item => (
                      <ItemCard key={item.id} item={item} currency={restaurant.currency}
                        onAdd={(mi) => useCartStore.getState().addItem(mi)} />
                    ))}
                  </div>
                </section>
              );
            })()}
            {items.length === 0 && (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">🍽️</p>
                <p className="text-slate-500 text-sm">Menu is being prepared. Please ask your server.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sticky cart button */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 z-40">
          <button
            onClick={() => setCartOpen(true)}
            className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xl transition active:scale-95 w-full max-w-sm justify-between">
            <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">{cartCount}</span>
            <span className="font-semibold">View order</span>
            <span className="font-bold">${useCartStore.getState().subtotal().toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Cart drawer */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        restaurantId={restaurant.id}
        sessionToken={data.session.sessionToken}
        currency={restaurant.currency}
        onOrderPlaced={handleOrderPlaced}
      />
    </div>
  );
}
