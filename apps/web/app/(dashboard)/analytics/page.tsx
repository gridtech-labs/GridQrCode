"use client";

import { useEffect, useState } from "react";
import { useRestaurantStore } from "../../../store/restaurantStore";
import { currencySymbol, formatCurrency } from "../../../lib/currency";
import api from "../../../lib/api";

interface AnalyticsData {
  summary: {
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
    completedOrders: number;
    cancelledOrders: number;
    cancellationRate: number;
    totalQrScans: number;
  };
  dailyRevenue: Array<{ day: string; orders: number; revenue: number }>;
  topItems: Array<{ name: string; sold: number; revenue: number }>;
  hourlyOrders: Array<{ hour: number; orders: number }>;
}

function StatCard({ icon, label, value, sub, color = "indigo" }: {
  icon: string; label: string; value: string | number; sub?: string; color?: string;
}) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-700",
    green:  "bg-green-50  text-green-700",
    amber:  "bg-amber-50  text-amber-700",
    red:    "bg-red-50    text-red-700",
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3 ${colors[color]}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

// Simple SVG bar chart
function BarChart({ data, valueKey, labelKey, color = "#4F46E5" }: {
  data: Record<string, number | string>[];
  valueKey: string;
  labelKey: string;
  color?: string;
}) {
  if (!data.length) return <div className="h-40 flex items-center justify-center text-slate-400 text-sm">No data yet</div>;

  const max = Math.max(...data.map((d) => Number(d[valueKey])), 1);
  const show = data.filter((_, i) => i % Math.ceil(data.length / 10) === 0 || i === data.length - 1);

  return (
    <div className="h-40 flex items-end gap-0.5 overflow-hidden">
      {data.map((d, i) => {
        const h = Math.max(2, (Number(d[valueKey]) / max) * 100);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
            <div
              className="w-full rounded-t transition-all hover:opacity-80 cursor-pointer"
              style={{ height: `${h}%`, backgroundColor: color }}
            />
            <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 bg-slate-900 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap z-10 pointer-events-none">
              {String(d[labelKey])}: {Number(d[valueKey]).toFixed(2)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Horizontal bar for top items
function HorizontalBar({ name, sold, revenue, maxSold }: {
  name: string; sold: number; revenue: number; maxSold: number;
}) {
  const pct = maxSold > 0 ? (sold / maxSold) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-slate-800 truncate">{name}</p>
          <span className="text-xs text-slate-500 shrink-0 ml-2">{sold} sold · ${revenue.toFixed(2)}</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

// Heat-map style peak hours
function PeakHoursChart({ data }: { data: Array<{ hour: number; orders: number }> }) {
  const max = Math.max(...data.map((d) => d.orders), 1);
  return (
    <div className="flex gap-1 items-end">
      {data.map((d) => {
        const intensity = d.orders / max;
        const opacity = intensity === 0 ? 0.08 : 0.15 + intensity * 0.85;
        return (
          <div key={d.hour} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div
              className="w-full rounded cursor-pointer"
              style={{ height: "40px", backgroundColor: `rgba(79,70,229,${opacity})` }}
            />
            <span className="text-xs text-slate-400" style={{ fontSize: "9px" }}>
              {d.hour === 0 ? "12a" : d.hour === 12 ? "12p" : d.hour > 12 ? `${d.hour-12}p` : `${d.hour}a`}
            </span>
            {d.orders > 0 && (
              <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 bg-slate-900 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap z-10 pointer-events-none">
                {d.hour}:00 — {d.orders} orders
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<{ data: AnalyticsData }>(`/analytics/dashboard?days=${days}`)
      .then(res => setData(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  const restaurant = useRestaurantStore(s => s.restaurant);
  const sym = currencySymbol(restaurant?.currency);
  const fmt = (n: number) => n >= 1000 ? `${sym}${(n/1000).toFixed(1)}k` : `${sym}${n.toFixed(2)}`;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">Performance overview for the last {days} days</p>
        </div>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${days === d ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-2xl border border-slate-200 h-28 animate-pulse" />)}
        </div>
      ) : data ? (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon="💰" label="Total revenue" value={fmt(data.summary.totalRevenue)} color="green" />
            <StatCard icon="📦" label="Total orders" value={data.summary.totalOrders} sub={`${data.summary.completedOrders} completed`} />
            <StatCard icon="🧾" label="Avg order value" value={`$${data.summary.avgOrderValue.toFixed(2)}`} color="indigo" />
            <StatCard icon="📱" label="QR scans" value={data.summary.totalQrScans} sub={`${data.summary.cancellationRate.toFixed(1)}% cancellation rate`} color="amber" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
            {/* Daily revenue chart */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900 mb-4">Daily Revenue</h2>
              <BarChart data={data.dailyRevenue} valueKey="revenue" labelKey="day" />
              <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
                <span>{data.dailyRevenue[0]?.day}</span>
                <span>{data.dailyRevenue[data.dailyRevenue.length - 1]?.day}</span>
              </div>
            </div>

            {/* Peak hours */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900 mb-4">Peak Hours</h2>
              <PeakHoursChart data={data.hourlyOrders} />
              <p className="text-xs text-slate-400 mt-3 text-center">Hover bars to see order counts</p>
            </div>
          </div>

          {/* Top items */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Top Menu Items</h2>
            {data.topItems.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No orders yet — top items will appear here.</p>
            ) : (
              <div className="space-y-4">
                {data.topItems.map((item) => (
                  <HorizontalBar
                    key={item.name}
                    name={item.name}
                    sold={item.sold}
                    revenue={item.revenue}
                    maxSold={data.topItems[0].sold}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mb-4">📊</div>
          <h3 className="font-semibold text-slate-900 mb-1">No analytics yet</h3>
          <p className="text-sm text-slate-500">Place some orders to start seeing data here.</p>
        </div>
      )}
    </div>
  );
}
