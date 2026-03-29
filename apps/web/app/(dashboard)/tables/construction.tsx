"use client";

export function Construction({ name, sprint }: { name: string; sprint: string }) {
  return (
    <div className="max-w-lg mx-auto mt-20 text-center space-y-5">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-3xl mx-auto">
        🚧
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-900">{name}</h2>
        <p className="text-slate-500 text-sm mt-1">
          This section is coming in <span className="font-medium text-indigo-600">Sprint {sprint}</span>.
        </p>
      </div>
      <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium px-4 py-2 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
        Sprint 1 complete — building sprint 2 next
      </div>
    </div>
  );
}
