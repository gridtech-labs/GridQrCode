"use client";

import { useEffect, useState } from "react";
import { useBillingStore } from "../../../../store/billingStore";
import type { Plan } from "@qr-saas/shared";

// ── Usage bar ─────────────────────────────────────────────────
function UsageBar({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max === 9999 ? 0 : Math.min(100, Math.round((used / max) * 100));
  const isUnlimited = max === 9999;
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-indigo-500";

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-sm text-slate-500">
          {used} / {isUnlimited ? "∞" : max}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {isUnlimited && (
        <div className="h-2 bg-indigo-100 rounded-full">
          <div className="h-full w-full bg-gradient-to-r from-indigo-400 to-violet-400 rounded-full" />
        </div>
      )}
    </div>
  );
}

// ── Plan card ─────────────────────────────────────────────────
function PlanCard({
  plan,
  isCurrent,
  billingCycle,
  onSelect,
  loading,
}: {
  plan: Plan;
  isCurrent: boolean;
  billingCycle: "monthly" | "yearly";
  onSelect: (planId: string) => void;
  loading: boolean;
}) {
  const price = billingCycle === "yearly" ? plan.priceYearly / 12 : plan.priceMonthly;
  const savings = Math.round(((plan.priceMonthly * 12 - plan.priceYearly) / (plan.priceMonthly * 12)) * 100);

  const PLAN_COLORS: Record<string, { border: string; bg: string; badge: string; btn: string }> = {
    starter:    { border: "border-slate-200",  bg: "bg-white",          badge: "bg-slate-100 text-slate-600",          btn: "bg-slate-800 hover:bg-slate-700 text-white" },
    pro:        { border: "border-indigo-400", bg: "bg-indigo-50",      badge: "bg-indigo-600 text-white",             btn: "bg-indigo-600 hover:bg-indigo-700 text-white" },
    enterprise: { border: "border-violet-400", bg: "bg-violet-50",      badge: "bg-violet-600 text-white",             btn: "bg-violet-600 hover:bg-violet-700 text-white" },
  };
  const colors = PLAN_COLORS[plan.name] ?? PLAN_COLORS.starter;
  const isPro = plan.name === "pro";

  const FEATURE_LABELS: Record<string, string> = {
    advancedAnalytics: "Advanced analytics",
    customDomain:      "Custom domain",
    whiteLabel:        "White-label branding",
    prioritySupport:   "Priority support",
    bulkQrDownload:    "Bulk QR download",
    apiAccess:         "API access",
  };

  return (
    <div className={`relative rounded-2xl border-2 ${colors.border} ${colors.bg} p-6 flex flex-col`}>
      {isPro && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
            Most popular
          </span>
        </div>
      )}

      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${colors.badge}`}>
            {plan.name}
          </span>
          {isCurrent && (
            <span className="text-xs font-medium text-green-700 bg-green-100 border border-green-200 px-2.5 py-1 rounded-full">
              Current plan
            </span>
          )}
        </div>
        <div className="flex items-end gap-1">
          <span className="text-4xl font-black text-slate-900">${price.toFixed(0)}</span>
          <span className="text-slate-500 text-sm mb-1">/mo</span>
        </div>
        {billingCycle === "yearly" && savings > 0 && (
          <p className="text-xs text-green-600 font-medium mt-1">Save {savings}% vs monthly</p>
        )}
      </div>

      <div className="space-y-2 mb-6 flex-1">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="text-indigo-500">🪑</span>
          {plan.maxTables === 9999 ? "Unlimited tables" : `Up to ${plan.maxTables} tables`}
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="text-indigo-500">📋</span>
          {plan.maxMenuItems === 9999 ? "Unlimited menu items" : `Up to ${plan.maxMenuItems} menu items`}
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="text-indigo-500">👥</span>
          {plan.maxStaff === 9999 ? "Unlimited staff" : `Up to ${plan.maxStaff} staff`}
        </div>

        <div className="border-t border-slate-200 pt-3 mt-3 space-y-2">
          {Object.entries(plan.features).map(([key, enabled]) => (
            <div key={key} className={`flex items-center gap-2 text-sm ${enabled ? "text-slate-700" : "text-slate-300"}`}>
              <span className={enabled ? "text-green-500" : "text-slate-300"}>{enabled ? "✓" : "✕"}</span>
              {FEATURE_LABELS[key] ?? key}
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => !isCurrent && onSelect(plan.id)}
        disabled={isCurrent || loading}
        className={`w-full py-3 rounded-xl text-sm font-semibold transition disabled:opacity-50
                    ${isCurrent ? "bg-slate-100 text-slate-400 cursor-default" : colors.btn}`}
      >
        {isCurrent ? "Current plan" : loading ? "Updating…" : `Switch to ${plan.name}`}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function BillingPage() {
  const { plans, subscription, usage, history, isLoading, fetchAll, changePlan } = useBillingStore();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [changingPlan, setChangingPlan] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSelectPlan = async (planId: string) => {
    setChangingPlan(true);
    setErrorMsg("");
    try {
      await changePlan(planId, billingCycle);
      setSuccessMsg("Plan updated successfully!");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch {
      setErrorMsg("Failed to change plan. Please try again.");
    } finally {
      setChangingPlan(false);
    }
  };

  if (isLoading && !plans.length) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-2xl border h-48 animate-pulse" />)}
      </div>
    );
  }

  const trialDaysLeft = subscription
    ? null
    : (() => {
        const r = (window as unknown as { __restaurant?: { trialEndsAt?: string } }).__restaurant;
        return null;
      })();

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Billing & Plans</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your subscription and view usage</p>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm font-medium">
          ✓ {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm font-medium">
          ✕ {errorMsg}
        </div>
      )}

      {/* Current subscription */}
      {subscription && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Current Subscription</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Plan",    value: subscription.planName.charAt(0).toUpperCase() + subscription.planName.slice(1) },
              { label: "Status",  value: subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1) },
              { label: "Billing", value: subscription.billingCycle.charAt(0).toUpperCase() + subscription.billingCycle.slice(1) },
              { label: "Renews",  value: subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : "—" },
            ].map(item => (
              <div key={item.label}>
                <p className="text-xs text-slate-400 mb-1">{item.label}</p>
                <p className="font-semibold text-slate-900 text-sm">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usage */}
      {usage && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-5">Usage This Month</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
            <UsageBar label="Tables"     used={usage.tables.used}    max={usage.tables.max} />
            <UsageBar label="Menu Items" used={usage.menuItems.used}  max={usage.menuItems.max} />
            <UsageBar label="Staff"      used={usage.staff.used}      max={usage.staff.max} />
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Orders this month</p>
              <p className="text-2xl font-bold text-slate-900">{usage.ordersThisMonth}</p>
            </div>
            <div className="bg-indigo-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">Revenue this month</p>
              <p className="text-2xl font-bold text-indigo-700">${usage.revenueThisMonth.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Plan selector */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-slate-900">Choose a Plan</h2>
          {/* Billing cycle toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(["monthly", "yearly"] as const).map((cycle) => (
              <button
                key={cycle}
                onClick={() => setBillingCycle(cycle)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition
                            ${billingCycle === cycle ? "bg-white text-slate-900 shadow" : "text-slate-500 hover:text-slate-700"}`}
              >
                {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                {cycle === "yearly" && <span className="ml-1.5 text-xs text-green-600 font-bold">-17%</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={subscription?.planName === plan.name}
              billingCycle={billingCycle}
              onSelect={handleSelectPlan}
              loading={changingPlan}
            />
          ))}
        </div>

        <p className="text-xs text-slate-400 text-center mt-4">
          💳 Payments powered by Stripe — coming soon. Plan changes are simulated in dev mode.
        </p>
      </div>

      {/* Billing history */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Billing History</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {history.map((record) => (
              <div key={record.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{record.description}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(record.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">
                    {record.amount === 0 ? "—" : `$${record.amount.toFixed(2)}`}
                  </p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    record.status === "paid"    ? "bg-green-100 text-green-700" :
                    record.status === "pending" ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-700"
                  }`}>
                    {record.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
