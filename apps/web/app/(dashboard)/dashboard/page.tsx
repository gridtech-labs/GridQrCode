"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "../../../store/authStore";
import { useRestaurantStore } from "../../../store/restaurantStore";
import { useMenuStore } from "../../../store/menuStore";
import { useTableStore } from "../../../store/tableStore";
import { useOrderStore } from "../../../store/orderStore";
import { useBillingStore } from "../../../store/billingStore";
import Link from "next/link";
import { currencySymbol } from "../../../lib/currency";

const SPRINTS = [
  { num: 1, name: "Auth & Foundation",      done: true  },
  { num: 2, name: "Restaurant & Menu",      done: true  },
  { num: 3, name: "Tables & QR Codes",      done: true  },
  { num: 4, name: "Ordering Engine",        done: true  },
  { num: 5, name: "Kitchen Display",        done: true  },
  { num: 6, name: "Settings & Billing",     done: true  },
  { num: 7, name: "Analytics",              done: true  },
  { num: 8, name: "Polish & Launch",        done: true  },
];

function StatCard({ icon, label, value, href, sub }: {
  icon: string; label: string; value: string | number; href?: string; sub?: string;
}) {
  const inner = (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-2xl shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function TrialBanner({ endsAt }: { endsAt: string }) {
  const days = Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000));
  const urgent = days <= 3;
  return (
    <div className={`rounded-2xl border px-5 py-4 flex items-center justify-between gap-4 ${urgent ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{urgent ? "🚨" : "⏳"}</span>
        <div>
          <p className={`font-medium text-sm ${urgent ? "text-red-900" : "text-amber-900"}`}>
            {days === 0 ? "Your trial ends today!" : `${days} day${days !== 1 ? "s" : ""} left in your free trial`}
          </p>
          <p className={`text-xs mt-0.5 ${urgent ? "text-red-700" : "text-amber-700"}`}>
            Upgrade to keep your data after the trial ends.
          </p>
        </div>
      </div>
      <Link href="/settings" className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium text-white transition ${urgent ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}`}>
        Upgrade now
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { restaurant, fetch: fetchRestaurant } = useRestaurantStore();
  const { categories, items, fetchCategories, fetchItems } = useMenuStore();
  const { tables, areas, fetchTables, fetchAreas } = useTableStore();
  const { stats, fetchStats } = useOrderStore();
  const { usage, fetchUsage } = useBillingStore();
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const sym = currencySymbol(restaurant?.currency);

  useEffect(() => {
    fetchRestaurant();
    fetchCategories();
    fetchItems();
    fetchTables();
    fetchAreas();
    fetchStats();
    fetchUsage();
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/v1/health`)
      .then(r => setApiOk(r.ok))
      .catch(() => setApiOk(false));
  }, [fetchRestaurant, fetchCategories, fetchItems, fetchTables, fetchAreas, fetchStats, fetchUsage]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const name = user?.firstName ?? user?.email?.split("@")[0] ?? "there";
  const availableTables = tables.filter(t => t.status === "available").length;
  const occupiedTables  = tables.filter(t => t.status === "occupied").length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {restaurant?.subscriptionStatus === "trial" && restaurant.trialEndsAt && (
        <TrialBanner endsAt={restaurant.trialEndsAt} />
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-900">{greeting()}, {name} 👋</h1>
        {restaurant && <p className="text-slate-500 mt-1 text-sm">{restaurant.name}</p>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="🍽️" label="Menu items"  value={items.length}  href="/menu"   sub={`${items.filter(i => i.isAvailable).length} available`} />
        <StatCard icon="📂" label="Categories"  value={categories.length} href="/menu" />
        <StatCard icon="🪑" label="Tables"      value={tables.length} href="/tables" sub={`${availableTables} available · ${occupiedTables} occupied`} />
        <StatCard icon="📍" label="Areas"       value={areas.length}  href="/tables" />
        <StatCard icon="📦" label="Orders today"  value={stats?.totalOrders ?? "—"}  href="/orders" sub={stats ? `$${stats.totalRevenue.toFixed(2)} revenue` : "Loading…"} />
        <StatCard icon="💰" label="Revenue / mo"  value={usage ? `${sym}${usage.revenueThisMonth.toFixed(0)}` : "—"} href="/analytics" sub={usage ? `${usage.ordersThisMonth} orders` : ""} />
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Quick actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon:"🍔", label:"Add menu item",       href:"/menu" },
            { icon:"🪑", label:"Set up tables",       href:"/tables" },
            { icon:"⚙️", label:"Restaurant settings", href:"/settings" },
            { icon:"👥", label:"Invite staff",        href:"/staff" },
          ].map(a => (
            <Link key={a.label} href={a.href}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-100 text-center transition hover:bg-indigo-50 hover:border-indigo-200">
              <span className="text-2xl">{a.icon}</span>
              <span className="text-xs font-medium text-slate-700">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Sprint progress */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Build progress</h2>
          <div className="space-y-2">
            {SPRINTS.map(s => (
              <div key={s.num} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${s.done ? "bg-green-50" : "bg-slate-50"}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${s.done ? "bg-green-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                  {s.done ? "✓" : s.num}
                </div>
                <span className={`text-sm flex-1 ${s.done ? "text-green-800 font-medium" : "text-slate-500"}`}>S{s.num}: {s.name}</span>
                {s.done && <span className="text-xs text-green-600 font-medium">Complete</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {/* System status */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-4">System status</h2>
            <div className="space-y-2">
              {[
                { label: "API server",    ok: apiOk,                loading: apiOk === null },
                { label: "Auth service",  ok: !!user,               loading: false },
                { label: "Restaurant",    ok: !!restaurant,         loading: false },
                { label: "Menu loaded",   ok: items.length > 0 || categories.length > 0, loading: false },
                { label: "Tables",        ok: tables.length > 0,    loading: false },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between py-1">
                  <span className="text-sm text-slate-700">{s.label}</span>
                  {s.loading
                    ? <div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                    : <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.ok ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {s.ok ? "● Online" : "● —"}
                      </span>
                  }
                </div>
              ))}
            </div>
          </div>

          {/* Restaurant info */}
          {restaurant && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900 mb-3">Restaurant</h2>
              <div className="space-y-1.5">
                {[
                  { label: "Currency",    value: restaurant.currency },
                  { label: "Timezone",    value: restaurant.timezone },
                  { label: "Tax rate",    value: `${(restaurant.taxRate * 100).toFixed(0)}%` },
                  { label: "Slug",        value: `/${restaurant.slug}`, mono: true },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{row.label}</span>
                    <span className={`font-medium text-slate-800 ${row.mono ? "font-mono text-xs text-indigo-600" : ""}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
