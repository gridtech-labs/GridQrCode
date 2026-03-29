import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left panel — brand */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-slate-950 text-white relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-950 to-slate-950" />
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-indigo-600/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-violet-600/10 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl" />

        {/* Logo */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xl shadow-lg shadow-indigo-500/30">
              ⚡
            </div>
            <span className="text-lg font-bold tracking-tight">QR Order</span>
          </Link>
        </div>

        {/* Hero content */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-tight">
              Your restaurant,
              <br />
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                ordered smarter.
              </span>
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed max-w-sm">
              QR code menus, real-time kitchen updates, and a beautiful ordering experience — all in one platform.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: "2 min", label: "Setup time" },
              { value: "0 app", label: "Downloads needed" },
              { value: "14 days", label: "Free trial" },
            ].map((stat) => (
              <div key={stat.label} className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-xs text-slate-600">
          © {new Date().getFullYear()} QR Order. All rights reserved.
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex items-center justify-center p-6 lg:p-12 bg-white dark:bg-slate-900">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-lg">
                ⚡
              </div>
              <span className="font-bold text-slate-900 dark:text-white">QR Order</span>
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
