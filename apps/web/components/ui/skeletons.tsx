"use client";

// ── Base Skeleton ─────────────────────────────────────────────

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-slate-200 rounded-lg animate-pulse ${className}`} />
  );
}

// ── Card skeleton ─────────────────────────────────────────────

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
      <Skeleton className="h-5 w-2/3" />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i === lines - 2 ? "w-1/3" : "w-full"}`} />
      ))}
    </div>
  );
}

// ── Table card skeleton ───────────────────────────────────────

export function TableCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden">
      <div className="h-1.5 bg-slate-200" />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-4 w-24" />
        <div className="grid grid-cols-2 gap-1.5 pt-2">
          <Skeleton className="h-8 rounded-lg" />
          <Skeleton className="h-8 rounded-lg" />
          <Skeleton className="h-8 rounded-lg" />
          <Skeleton className="h-8 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ── Menu item skeleton ────────────────────────────────────────

export function MenuItemSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <Skeleton className="h-36 w-full rounded-none" />
      <div className="p-3 space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-8 rounded-lg mt-3" />
      </div>
    </div>
  );
}

// ── Order card skeleton ───────────────────────────────────────

export function OrderCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden">
      <div className="h-1.5 bg-slate-200" />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="flex justify-between pt-2 border-t border-slate-100">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-10 rounded-xl" />
      </div>
    </div>
  );
}

// ── Stat card skeleton ────────────────────────────────────────

export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4">
      <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-7 w-12" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

// ── Page-level skeletons ──────────────────────────────────────

export function DashboardSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <Skeleton className="h-5 w-32" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
    </div>
  );
}

export function TablesSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1"><Skeleton className="h-7 w-24" /><Skeleton className="h-4 w-36" /></div>
        <div className="flex gap-2"><Skeleton className="h-10 w-20 rounded-xl" /><Skeleton className="h-10 w-28 rounded-xl" /></div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <TableCardSkeleton key={i} />)}
      </div>
    </div>
  );
}

export function MenuSkeleton() {
  return (
    <div className="max-w-7xl mx-auto flex gap-5">
      <aside className="w-52 shrink-0">
        <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
          <Skeleton className="h-4 w-24 mb-3" />
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 rounded-lg" />)}
        </div>
      </aside>
      <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <MenuItemSkeleton key={i} />)}
      </div>
    </div>
  );
}

export function OrdersSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1"><Skeleton className="h-7 w-24" /><Skeleton className="h-4 w-40" /></div>
        <Skeleton className="h-10 w-24 rounded-xl" />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-24 rounded-xl shrink-0" />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <OrderCardSkeleton key={i} />)}
      </div>
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1"><Skeleton className="h-7 w-28" /><Skeleton className="h-4 w-44" /></div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <Skeleton className="h-5 w-36" />
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 rounded-lg" />)}
      </div>
    </div>
  );
}
