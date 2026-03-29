"use client";

import { useState } from "react";
import Link from "next/link";
import api from "../../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await api.post("/auth/forgot-password", { email });
      setSubmitted(true);
    } catch {
      // Always show success to avoid email enumeration
      setSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="space-y-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto text-3xl">
          ✉️
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Check your inbox</h2>
          <p className="text-slate-500 mt-2 text-sm max-w-sm mx-auto">
            If an account exists for <strong>{email}</strong>, we&apos;ve sent a reset link. Check your spam folder if needed.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-block text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
        >
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Reset your password</h2>
        <p className="text-slate-500 mt-1 text-sm">
          Enter your email and we&apos;ll send a reset link.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@restaurant.com"
            className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700
                       bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                       placeholder:text-slate-400 text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                       transition"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60
                     text-white font-semibold text-sm transition"
        >
          {isLoading ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500">
        Remember your password?{" "}
        <Link href="/login" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
