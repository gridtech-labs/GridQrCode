"use client";

import { useEffect, useRef, useState } from "react";

// ── Modal ─────────────────────────────────────────────────────

export function Modal({
  open, onClose, title, children, size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!open) return null;

  const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${widths[size]} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────

type BadgeVariant = "green" | "red" | "yellow" | "blue" | "gray" | "indigo";

export function Badge({ label, variant = "gray" }: { label: string; variant?: BadgeVariant }) {
  const styles: Record<BadgeVariant, string> = {
    green:  "bg-green-50  text-green-700  border-green-200",
    red:    "bg-red-50    text-red-700    border-red-200",
    yellow: "bg-yellow-50 text-yellow-700 border-yellow-200",
    blue:   "bg-blue-50   text-blue-700   border-blue-200",
    gray:   "bg-slate-50  text-slate-600  border-slate-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full border ${styles[variant]}`}>
      {label}
    </span>
  );
}

// ── Empty State ───────────────────────────────────────────────

export function EmptyState({
  icon, title, description, action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mb-4">{icon}</div>
      <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mb-4">{description}</p>
      {action}
    </div>
  );
}

// ── Image Upload ──────────────────────────────────────────────

export function ImageUpload({
  currentUrl, onUpload, label, aspectRatio = "square", disabled,
}: {
  currentUrl?: string | null;
  onUpload: (file: File) => Promise<void>;
  label: string;
  aspectRatio?: "square" | "wide";
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setIsUploading(true);
    try {
      await onUpload(file);
    } finally {
      setIsUploading(false);
      URL.revokeObjectURL(objectUrl);
    }
  };

  const height = aspectRatio === "wide" ? "h-32" : "h-32 w-32";

  return (
    <div>
      <p className="text-sm font-medium text-slate-700 mb-2">{label}</p>
      <div
        className={`relative ${height} rounded-xl border-2 border-dashed transition-colors cursor-pointer
                    ${isDragging ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-slate-300 bg-slate-50"}
                    ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover rounded-xl" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span className="text-2xl text-slate-400">📷</span>
            <span className="text-xs text-slate-400">Click or drag to upload</span>
          </div>
        )}
        {isUploading && (
          <div className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <p className="text-xs text-slate-400 mt-1">JPG, PNG or WebP · Max 5MB</p>
    </div>
  );
}

// ── Confirm Dialog ────────────────────────────────────────────

export function ConfirmDialog({
  open, onClose, onConfirm, title, description, confirmLabel = "Delete", variant = "danger",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "danger" | "warning";
}) {
  const [loading, setLoading] = useState(false);
  const handle = async () => {
    setLoading(true);
    try { await onConfirm(); onClose(); }
    finally { setLoading(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl mb-4
                         ${variant === "danger" ? "bg-red-100" : "bg-yellow-100"}`}>
          {variant === "danger" ? "🗑️" : "⚠️"}
        </div>
        <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 mb-6">{description}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button
            onClick={handle}
            disabled={loading}
            className={`flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60
                        ${variant === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-yellow-500 hover:bg-yellow-600"}`}
          >
            {loading ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────

export function Input({
  label, error, className = "", ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}
      <input
        {...props}
        className={`w-full px-3 py-2.5 rounded-lg border text-sm transition
                    bg-white text-slate-900 placeholder:text-slate-400
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                    ${error ? "border-red-400" : "border-slate-200"}
                    ${className}`}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// ── Textarea ──────────────────────────────────────────────────

export function Textarea({
  label, error, className = "", ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}
      <textarea
        {...props}
        className={`w-full px-3 py-2.5 rounded-lg border text-sm transition resize-none
                    bg-white text-slate-900 placeholder:text-slate-400
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                    ${error ? "border-red-400" : "border-slate-200"}
                    ${className}`}
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────

export function Select({
  label, error, options, className = "", ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}
      <select
        {...props}
        className={`w-full px-3 py-2.5 rounded-lg border text-sm bg-white text-slate-900
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                    ${error ? "border-red-400" : "border-slate-200"}
                    ${className}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
