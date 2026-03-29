"use client";

import { useEffect, useState, useCallback } from "react";
import { useOrderStore } from "../../../store/orderStore";
import type { Order, OrderStatus } from "@qr-saas/shared";

const STATUS_CONFIG: Record<OrderStatus, { label: string; dot: string; bg: string; border: string; text: string; next?: OrderStatus; nextLabel?: string }> = {
  pending:   { label: "Pending",   dot: "bg-amber-400",  bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-700",  next: "confirmed",  nextLabel: "Confirm" },
  confirmed: { label: "Confirmed", dot: "bg-indigo-500", bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700", next: "preparing",  nextLabel: "Start preparing" },
  preparing: { label: "Preparing", dot: "bg-orange-500", bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", next: "ready",       nextLabel: "Mark ready" },
  ready:     { label: "Ready",     dot: "bg-green-500",  bg: "bg-green-50",  border: "border-green-200",  text: "text-green-700",  next: "served",      nextLabel: "Mark served" },
  served:    { label: "Served",    dot: "bg-slate-400",  bg: "bg-slate-50",  border: "border-slate-200",  text: "text-slate-600"  },
  cancelled: { label: "Cancelled", dot: "bg-red-400",    bg: "bg-red-50",    border: "border-red-200",    text: "text-red-600"    },
};

const FILTER_TABS: { key: string; label: string }[] = [
  { key: "all",       label: "All orders"  },
  { key: "pending",   label: "Pending"     },
  { key: "confirmed", label: "Confirmed"   },
  { key: "preparing", label: "Preparing"   },
  { key: "ready",     label: "Ready"       },
  { key: "served",    label: "Served"      },
];

// ── Order Card ────────────────────────────────────────────────
function OrderCard({ order, onStatusUpdate }: { order: Order; onStatusUpdate: (id: string, status: OrderStatus) => Promise<void> }) {
  const cfg = STATUS_CONFIG[order.status];
  const [advancing, setAdvancing] = useState(false);

  const advance = async () => {
    if (!cfg.next) return;
    setAdvancing(true);
    try { await onStatusUpdate(order.id, cfg.next); }
    finally { setAdvancing(false); }
  };

  const cancel = async () => {
    setAdvancing(true);
    try { await onStatusUpdate(order.id, "cancelled"); }
    finally { setAdvancing(false); }
  };

  const placed = new Date(order.placedAt);
  const now    = new Date();
  const ageMin = Math.floor((now.getTime() - placed.getTime()) / 60000);

  return (
    <div className={`bg-white rounded-2xl border-2 ${cfg.border} overflow-hidden shadow-sm`}>
      {/* Colour stripe */}
      <div className={`h-1.5 ${cfg.dot}`} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="font-black text-slate-900 text-lg leading-none">#{order.orderNumber}</p>
            {order.tableNumber && (
              <p className="text-sm text-slate-500 mt-0.5">Table {order.tableNumber}</p>
            )}
          </div>
          <div className="text-right">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
            <p className="text-xs text-slate-400 mt-1">{ageMin < 1 ? "Just now" : `${ageMin}m ago`}</p>
          </div>
        </div>

        {/* Items */}
        <div className="space-y-1 mb-3 border-t border-slate-100 pt-3">
          {order.items.map(item => (
            <div key={item.id} className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0 mt-0.5">{item.quantity}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 truncate">{item.itemName}</p>
                {item.notes && <p className="text-xs text-slate-400 truncate">{item.notes}</p>}
              </div>
              <p className="text-sm font-medium text-slate-700 shrink-0">${item.totalPrice.toFixed(2)}</p>
            </div>
          ))}
          {order.notes && (
            <p className="text-xs text-slate-500 italic pt-1 border-t border-slate-50">📝 {order.notes}</p>
          )}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 mb-3">
          <span className="text-sm text-slate-500">Total</span>
          <span className="font-bold text-slate-900">${order.totalAmount.toFixed(2)}</span>
        </div>

        {/* Actions */}
        {!["served", "cancelled"].includes(order.status) && (
          <div className="flex gap-2">
            {cfg.next && (
              <button onClick={advance} disabled={advancing}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-60 ${cfg.bg} ${cfg.text} border ${cfg.border} hover:opacity-80`}>
                {advancing ? "…" : cfg.nextLabel}
              </button>
            )}
            <button onClick={cancel} disabled={advancing}
              className="py-2 px-3 rounded-xl text-sm font-medium text-red-500 border border-red-100 hover:bg-red-50 transition disabled:opacity-60">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────
function StatsBar() {
  const stats = useOrderStore(s => s.stats);
  if (!stats) return null;

  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {[
        { label: "Orders today",   value: stats.totalOrders,                      sub: "" },
        { label: "Pending",        value: stats.pendingOrders,                    sub: "awaiting action" },
        { label: "Revenue today",  value: `$${stats.totalRevenue.toFixed(2)}`,     sub: "excl. cancelled" },
        { label: "Avg order",      value: `$${stats.avgOrderValue.toFixed(2)}`,    sub: "" },
      ].map(s => (
        <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-1">{s.label}</p>
          <p className="text-xl font-bold text-slate-900">{s.value}</p>
          {s.sub && <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function OrdersPage() {
  const { orders, total, isLoading, fetchOrders, fetchStats, updateStatus, upsertOrder } = useOrderStore();
  const [activeFilter, setActiveFilter] = useState("all");

  const load = useCallback(() => {
    fetchOrders(activeFilter === "all" ? undefined : activeFilter);
    fetchStats();
  }, [activeFilter, fetchOrders, fetchStats]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 20s
  useEffect(() => {
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  const handleStatusUpdate = async (id: string, status: OrderStatus) => {
    await updateStatus(id, status);
  };

  const activeOrders  = orders.filter(o => !["served","cancelled"].includes(o.status));
  const finishedOrders = orders.filter(o => ["served","cancelled"].includes(o.status));

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Orders</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} total · auto-refreshes every 20s</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
          🔄 Refresh
        </button>
      </div>

      <StatsBar />

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 mb-5 overflow-x-auto pb-1">
        {FILTER_TABS.map(tab => {
          const count = tab.key === "all" ? orders.length : orders.filter(o => o.status === tab.key).length;
          return (
            <button key={tab.key} onClick={() => setActiveFilter(tab.key)}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${activeFilter === tab.key ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {tab.label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeFilter === tab.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Orders grid */}
      {isLoading && orders.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="bg-white rounded-2xl border border-slate-200 h-52 animate-pulse" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mb-4">📦</div>
          <h3 className="font-semibold text-slate-900 mb-1">No orders yet</h3>
          <p className="text-sm text-slate-500 max-w-xs">
            {activeFilter === "all"
              ? "Orders placed by customers will appear here in real time."
              : `No ${activeFilter} orders right now.`}
          </p>
        </div>
      ) : (
        <>
          {/* Active orders */}
          {activeOrders.length > 0 && (
            <div>
              <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wider mb-3">Active ({activeOrders.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {activeOrders.map(order => (
                  <OrderCard key={order.id} order={order} onStatusUpdate={handleStatusUpdate} />
                ))}
              </div>
            </div>
          )}

          {/* Completed orders */}
          {finishedOrders.length > 0 && (activeFilter === "all" || ["served","cancelled"].includes(activeFilter)) && (
            <div>
              <h2 className="font-semibold text-slate-400 text-sm uppercase tracking-wider mb-3">Completed ({finishedOrders.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
                {finishedOrders.map(order => (
                  <OrderCard key={order.id} order={order} onStatusUpdate={handleStatusUpdate} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
