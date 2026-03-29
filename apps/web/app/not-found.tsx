import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-24 h-24 rounded-3xl bg-indigo-100 flex items-center justify-center text-5xl mx-auto mb-6">
          🔍
        </div>
        <h1 className="text-4xl font-black text-slate-900 mb-2">404</h1>
        <h2 className="text-xl font-semibold text-slate-700 mb-3">Page not found</h2>
        <p className="text-slate-500 text-sm mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-100 transition"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
