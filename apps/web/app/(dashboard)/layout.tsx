"use client";

import { useEffect, useState } from "react";
import { ErrorBoundary } from "../../components/error/ErrorBoundary";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "../../store/authStore";

const NAV = [
  { href: "/dashboard",  icon: "⊞", label: "Dashboard"  },
  { href: "/orders",     icon: "🧾", label: "Orders"     },
  { href: "/kitchen",    icon: "🍳", label: "Kitchen"    },
  { href: "/menu",       icon: "📋", label: "Menu"       },
  { href: "/tables",     icon: "◫",  label: "Tables"     },
  { href: "/analytics",  icon: "📊", label: "Analytics"  },
  { href: "/staff",      icon: "👥", label: "Staff"      },
  { href: "/settings",   icon: "⚙",  label: "Settings"   },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout, fetchMe, _hasHydrated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Wait for Zustand to rehydrate from localStorage before making auth decisions
  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    fetchMe();
  }, [_hasHydrated, isAuthenticated, router, fetchMe]);

  // Show a full-page spinner while hydrating — prevents both 401s and hydration mismatch
  if (!_hasHydrated || !isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      </div>
    );
  }

  const initials = [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join("").toUpperCase() || user.email[0].toUpperCase();
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-30 flex flex-col w-56 bg-slate-900 border-r border-slate-800
                         transform transition-transform duration-200
                         ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
                         lg:relative lg:translate-x-0`}>
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-800 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-sm font-bold text-white shadow-lg">⚡</div>
          <span className="text-white font-semibold text-sm tracking-tight">QR Order</span>
        </div>

        <div className="mx-3 mt-4 px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Restaurant</p>
          <p className="text-sm text-white font-medium mt-0.5 truncate">
            {user.restaurantId ? "My Restaurant" : "Platform Admin"}
          </p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, icon, label }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link key={href} href={href} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                            ${active ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white hover:bg-slate-800"}`}>
                <span className="text-base w-5 text-center leading-none">{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-4 border-t border-slate-800 pt-4">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">{initials}</div>
            <div className="min-w-0">
              <p className="text-xs text-white font-medium truncate">{displayName}</p>
              <p className="text-xs text-slate-500 capitalize">{user.role}</p>
            </div>
          </div>
          <button onClick={async () => { await logout(); router.replace("/login"); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <span>↩</span> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <button className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="hidden lg:block">
            <p className="text-sm text-slate-500">
              {NAV.find(n => n.href === pathname || (n.href !== "/dashboard" && pathname.startsWith(n.href)))?.label ?? "Dashboard"}
            </p>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Sprints 1–5 Complete
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">{initials}</div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <ErrorBoundary pageName="this page">
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
