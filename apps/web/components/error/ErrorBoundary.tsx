"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  pageName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Log to console in dev; swap for Sentry/LogRocket in production
    if (process.env.NODE_ENV === "development") {
      console.error(`[ErrorBoundary] ${this.props.pageName ?? "Page"} crashed:`, error, info);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center text-3xl mb-5">
            ⚠️
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-slate-500 max-w-sm mb-5">
            {this.props.pageName
              ? `The ${this.props.pageName} page encountered an unexpected error.`
              : "An unexpected error occurred on this page."}
          </p>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <pre className="text-xs text-left bg-red-50 border border-red-200 rounded-xl p-4 max-w-lg overflow-auto mb-5 text-red-800">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition"
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// ── Functional wrapper for convenience ────────────────────────
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  pageName?: string
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary pageName={pageName}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
