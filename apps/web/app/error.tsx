"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("Global error:", error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 rounded-3xl bg-red-100 flex items-center justify-center text-5xl mx-auto mb-6">
            💥
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">Something went wrong</h1>
          <p className="text-slate-500 text-sm mb-2">
            An unexpected error occurred. Our team has been notified.
          </p>
          {process.env.NODE_ENV === "development" && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 font-mono text-left">
              {error.message}
            </p>
          )}
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={reset}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.href = "/dashboard"}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-100 transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
