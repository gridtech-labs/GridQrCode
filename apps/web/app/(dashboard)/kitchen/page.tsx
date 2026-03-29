"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "../../../store/authStore";
import {
  useKitchenStore,
  connectKitchenSocket,
  disconnectKitchenSocket,
} from "../../../store/kitchenStore";
import type { Order, OrderItemStatus } from "@qr-saas/shared";

// ── Config ────────────────────────────────────────────────────
const COLUMN_CONFIG = [
  { key: "confirmed",  label: "New Orders",  dot: "bg-indigo-500", bg: "bg-indigo-50",  border: "border-indigo-200", text: "text-indigo-700"  },
  { key: "preparing",  label: "Preparing",   dot: "bg-orange-500", bg: "bg-orange-50",  border: "border-orange-200", text: "text-orange-700"  },
  { key: "ready",      label: "Ready",       dot: "bg-green-500",  bg: "bg-green-50",   border: "border-green-200",  text: "text-green-700"   },
] as const;

const ITEM_STATUS_NEXT: Partial<Record<OrderItemStatus, OrderItemStatus>> = {
  pending:   "preparing",
  preparing: "ready",
};

// ── Age timer ─────────────────────────────────────────────────
function useAge(placedAt: string): number {
  const [secs, setSecs] = useState(() =>
    Math.floor((Date.now() - new Date(placedAt).getTime()) / 1000)
  );
  useEffect(() => {
    const t = setInterval(() =>
      setSecs(Math.floor((Date.now() - new Date(placedAt).getTime()) / 1000)), 1000
    );
    return () => clearInterval(t);
  }, [placedAt]);
  return secs;
}

function AgeDisplay({ placedAt }: { placedAt: string }) {
  const secs = useAge(placedAt);
  const mins = Math.floor(secs / 60);
  const urgent = secs > 600; // 10 min
  const warn   = secs > 300; // 5 min

  const color = urgent ? "text-red-600 font-bold" : warn ? "text-amber-600 font-semibold" : "text-slate-500";
  const label = mins > 0 ? `${mins}m ${secs % 60}s` : `${secs}s`;

  return (
    <span className={`text-xs tabular-nums ${color}`}>
      ⏱ {label}{urgent ? " !" : ""}
    </span>
  );
}

// ── Order Item row ────────────────────────────────────────────
function ItemRow({
  item,
  onBump,
}: {
  item: Order["items"][number];
  onBump: (itemId: string, status: OrderItemStatus) => void;
}) {
  const next = ITEM_STATUS_NEXT[item.status];
  const done = item.status === "ready" || item.status === "served";

  return (
    <div className={`flex items-start gap-3 py-2 ${done ? "opacity-50" : ""}`}>
      <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0 mt-0.5">
        {item.quantity}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${done ? "line-through text-slate-400" : "text-slate-900"}`}>
          {item.itemName}
        </p>
        {item.modifications?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {item.modifications.map((m, i) => (
              <span key={i} className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                {m.optionName}{m.priceDelta > 0 ? ` +$${m.priceDelta.toFixed(2)}` : ""}
              </span>
            ))}
          </div>
        )}
        {item.notes && (
          <p className="text-xs text-slate-400 italic mt-0.5">"{item.notes}"</p>
        )}
      </div>
      {next && !done && (
        <button
          onClick={() => onBump(item.id, next)}
          className="shrink-0 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-600 transition"
        >
          {next === "preparing" ? "Start" : "Ready"}
        </button>
      )}
      {done && <span className="text-green-500 text-sm shrink-0">✓</span>}
    </div>
  );
}

// ── Order card ────────────────────────────────────────────────
function OrderCard({
  order,
  onItemBump,
  onBumpAll,
}: {
  order: Order;
  onItemBump: (orderId: string, itemId: string, status: OrderItemStatus) => void;
  onBumpAll: (orderId: string) => void;
}) {
  const [bumping, setBumping] = useState(false);
  const cfg = COLUMN_CONFIG.find((c) => c.key === order.status) ?? COLUMN_CONFIG[0];

  const handleBumpAll = async () => {
    setBumping(true);
    try { await onBumpAll(order.id); }
    finally { setBumping(false); }
  };

  const nextLabel: Partial<Record<string, string>> = {
    confirmed: "Start all",
    preparing: "All ready",
  };

  return (
    <div className={`bg-white rounded-2xl border-2 ${cfg.border} shadow-sm overflow-hidden`}>
      {/* Header stripe */}
      <div className={`h-1.5 ${cfg.dot}`} />

      <div className="p-4">
        {/* Order header */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <p className="font-black text-slate-900 text-xl leading-none">#{order.orderNumber}</p>
            {order.tableNumber && (
              <p className="text-sm text-slate-500 mt-0.5">Table {order.tableNumber}</p>
            )}
          </div>
          <div className="text-right">
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
              {cfg.label}
            </span>
            <div className="mt-1 flex justify-end">
              <AgeDisplay placedAt={order.placedAt} />
            </div>
          </div>
        </div>

        {order.notes && (
          <p className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1 mb-2 italic">
            📝 {order.notes}
          </p>
        )}

        {/* Items */}
        <div className="divide-y divide-slate-50 mb-3">
          {order.items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onBump={(itemId, status) => onItemBump(order.id, itemId, status)}
            />
          ))}
        </div>

        {/* Bump all button */}
        {nextLabel[order.status] && (
          <button
            onClick={handleBumpAll}
            disabled={bumping}
            className={`w-full py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-60
                        ${cfg.bg} ${cfg.text} border-2 ${cfg.border} hover:opacity-80`}
          >
            {bumping ? "Updating…" : nextLabel[order.status]}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────
function KitchenStatsBar() {
  const stats = useKitchenStore((s) => s.stats);
  const connected = useKitchenStore((s) => s.connected);

  if (!stats) return null;

  const avgMins = stats.avgPrepSeconds > 0
    ? `${Math.round(stats.avgPrepSeconds / 60)}m avg`
    : "—";

  return (
    <div className="flex items-center gap-3 mb-5 overflow-x-auto pb-1">
      {[
        { label: "Confirmed", value: stats.confirmed, dot: "bg-indigo-500" },
        { label: "Preparing", value: stats.preparing, dot: "bg-orange-500" },
        { label: "Ready",     value: stats.ready,     dot: "bg-green-500"  },
        { label: "Avg prep",  value: avgMins,          dot: "bg-slate-400"  },
      ].map(s => (
        <div key={s.label} className="shrink-0 flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5">
          <div className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
          <span className="text-sm font-bold text-slate-900">{s.value}</span>
          <span className="text-xs text-slate-400">{s.label}</span>
        </div>
      ))}
      <div className={`shrink-0 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium ml-auto
                       ${connected ? "bg-green-50 text-green-700 border border-green-200" : "bg-slate-50 text-slate-400 border border-slate-200"}`}>
        <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-slate-400"}`} />
        {connected ? "Live" : "Reconnecting…"}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function KitchenPage() {
  const { user } = useAuthStore();
  const { orders, isLoading, fetchOrders, fetchStats, updateItemStatus, bumpOrder } = useKitchenStore();

  useEffect(() => {
    if (!user?.restaurantId) return;
    fetchOrders();
    fetchStats();
    connectKitchenSocket(user.restaurantId);
    return () => disconnectKitchenSocket();
  }, [user?.restaurantId, fetchOrders, fetchStats]);

  // Auto-refresh stats every 30s
  useEffect(() => {
    const t = setInterval(() => fetchStats(), 30000);
    return () => clearInterval(t);
  }, [fetchStats]);

  const handleItemBump = useCallback(async (orderId: string, itemId: string, status: OrderItemStatus) => {
    await updateItemStatus(orderId, itemId, status);
  }, [updateItemStatus]);

  const handleBumpAll = useCallback(async (orderId: string) => {
    await bumpOrder(orderId);
  }, [bumpOrder]);

  // Group orders by status
  const byStatus = (status: string) => orders.filter((o) => o.status === status);

  const totalActive = orders.filter((o) =>
    ["confirmed", "preparing", "ready"].includes(o.status)
  ).length;

  return (
    <div className="max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Kitchen Display</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {totalActive} active order{totalActive !== 1 ? "s" : ""} · real-time via Socket.io
          </p>
        </div>
        <button
          onClick={() => { fetchOrders(); fetchStats(); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
        >
          🔄 Refresh
        </button>
      </div>

      <KitchenStatsBar />

      {/* KDS columns */}
      {isLoading && orders.length === 0 ? (
        <div className="grid grid-cols-3 gap-5">
          {[...Array(3)].map((_, col) => (
            <div key={col} className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200 h-40 animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
          {COLUMN_CONFIG.map((col) => {
            const colOrders = byStatus(col.key);
            return (
              <div key={col.key}>
                {/* Column header */}
                <div className={`flex items-center gap-2 mb-3 px-1`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                  <h2 className="font-semibold text-slate-700 text-sm">{col.label}</h2>
                  <span className="ml-auto text-xs text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                    {colOrders.length}
                  </span>
                </div>

                {/* Orders in this column */}
                {colOrders.length === 0 ? (
                  <div className={`rounded-2xl border-2 border-dashed ${col.border} p-8 text-center`}>
                    <p className="text-2xl mb-2 opacity-40">
                      {col.key === "confirmed" ? "🎉" : col.key === "preparing" ? "👨‍🍳" : "🔔"}
                    </p>
                    <p className={`text-xs font-medium ${col.text} opacity-60`}>No orders here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {colOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onItemBump={handleItemBump}
                        onBumpAll={handleBumpAll}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state when no active orders at all */}
      {!isLoading && totalActive === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center text-4xl mb-5">🍳</div>
          <h3 className="font-semibold text-slate-900 text-lg mb-2">All caught up!</h3>
          <p className="text-sm text-slate-500 max-w-xs">
            No active orders right now. New orders will appear here automatically when customers place them.
          </p>
        </div>
      )}
    </div>
  );
}
