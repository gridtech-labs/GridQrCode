"use client";

import { useEffect, useState, useRef } from "react";
import { useTableStore } from "../../../store/tableStore";
import type { Area, Table, TableStatus, CreateTableDto } from "@qr-saas/shared";

// ── Status config ─────────────────────────────────────────────
const STATUS_CONFIG: Record<TableStatus, { label: string; dot: string; bg: string; border: string; text: string }> = {
  available: { label: "Available",  dot: "bg-green-500",  bg: "bg-green-50",  border: "border-green-200", text: "text-green-700" },
  occupied:  { label: "Occupied",   dot: "bg-rose-500",   bg: "bg-rose-50",   border: "border-rose-200",  text: "text-rose-700"  },
  reserved:  { label: "Reserved",   dot: "bg-yellow-500", bg: "bg-yellow-50", border: "border-yellow-200",text: "text-yellow-700"},
  cleaning:  { label: "Cleaning",   dot: "bg-slate-400",  bg: "bg-slate-50",  border: "border-slate-200", text: "text-slate-600" },
};

// ── Primitives ────────────────────────────────────────────────
function Modal({ open, onClose, title, children, size = "md" }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: "sm"|"md";
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${size === "sm" ? "max-w-sm" : "max-w-lg"} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400";

// ── QR Modal ──────────────────────────────────────────────────
function QrModal({ table, open, onClose }: { table: Table | null; open: boolean; onClose: () => void }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  if (!table) return null;

  const dinerUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/r/${table.qrToken}`;

  return (
    <Modal open={open} onClose={onClose} title={`QR Code — Table ${table.number}`} size="sm">
      <div className="flex flex-col items-center gap-5">
        {/* QR image via API */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${apiUrl}/api/v1/tables/${table.id}/qr.png`}
          alt={`QR code for table ${table.number}`}
          className="w-56 h-56 rounded-xl border border-slate-200 shadow-sm"
        />

        <div className="w-full bg-slate-50 rounded-xl px-4 py-3 text-center">
          <p className="text-xs text-slate-400 mb-1">Diner URL</p>
          <p className="text-xs font-mono text-indigo-600 break-all">{dinerUrl}</p>
        </div>

        <div className="flex gap-3 w-full">
          <a
            href={`${apiUrl}/api/v1/tables/${table.id}/qr.png`}
            download={`table-${table.number}-qr.png`}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium text-center transition"
          >
            ⬇ Download PNG
          </a>
          <a
            href={`${apiUrl}/api/v1/tables/${table.id}/qr.svg`}
            download={`table-${table.number}-qr.svg`}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium text-center hover:bg-slate-50 transition"
          >
            ⬇ Download SVG
          </a>
        </div>

        <button
          onClick={() => window.print()}
          className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
        >
          🖨 Print QR Code
        </button>
      </div>
    </Modal>
  );
}

// ── Status Modal ──────────────────────────────────────────────
function StatusModal({ table, open, onClose, onSave }: {
  table: Table | null; open: boolean; onClose: () => void; onSave: (status: TableStatus) => Promise<void>;
}) {
  const [status, setStatus] = useState<TableStatus>("available");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (table && open) setStatus(table.status); }, [table, open]);

  const save = async () => {
    setSaving(true);
    try { await onSave(status); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Update Status — Table ${table?.number}`} size="sm">
      <div className="space-y-3 mb-5">
        {(Object.keys(STATUS_CONFIG) as TableStatus[]).map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <button key={s} onClick={() => setStatus(s)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition ${status === s ? `${cfg.border} ${cfg.bg}` : "border-transparent hover:bg-slate-50"}`}>
              <div className={`w-3 h-3 rounded-full ${cfg.dot}`} />
              <span className={`text-sm font-medium ${status === s ? cfg.text : "text-slate-700"}`}>{cfg.label}</span>
              {status === s && <span className="ml-auto text-lg">✓</span>}
            </button>
          );
        })}
      </div>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
        <button onClick={save} disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-60">
          {saving ? "Saving…" : "Update status"}
        </button>
      </div>
    </Modal>
  );
}

// ── Table Form Modal ──────────────────────────────────────────
function TableFormModal({ open, onClose, areas, initial }: {
  open: boolean; onClose: () => void; areas: Area[]; initial?: Table | null;
}) {
  const { createTable, updateTable } = useTableStore();
  const [form, setForm] = useState({ number: "", name: "", capacity: 4, areaId: "" });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ number: initial?.number ?? "", name: initial?.name ?? "", capacity: initial?.capacity ?? 4, areaId: initial?.areaId ?? "" });
      setErr("");
    }
  }, [open, initial]);

  const save = async () => {
    if (!form.number.trim()) { setErr("Table number is required"); return; }
    setSaving(true);
    try {
      const dto: CreateTableDto = { number: form.number.trim(), name: form.name.trim() || undefined, capacity: form.capacity, areaId: form.areaId || undefined };
      if (initial) await updateTable(initial.id, dto);
      else await createTable(dto);
      onClose();
    } catch { setErr("Failed to save table"); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit Table" : "New Table"} size="sm">
      <div className="space-y-4">
        {err && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Table number *</label>
          <input className={inputCls} value={form.number} onChange={e => setForm(f => ({...f, number: e.target.value}))} placeholder="e.g. T1 or 12" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Display name</label>
          <input className={inputCls} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Window Table (optional)" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Capacity</label>
            <input className={inputCls} type="number" min="1" max="50" value={form.capacity} onChange={e => setForm(f => ({...f, capacity: +e.target.value || 4}))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Area</label>
            <select className={inputCls} value={form.areaId} onChange={e => setForm(f => ({...f, areaId: e.target.value}))}>
              <option value="">— No area —</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-60">
            {saving ? "Saving…" : initial ? "Update" : "Create Table"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Area Form Modal ───────────────────────────────────────────
function AreaFormModal({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Area | null }) {
  const { createArea, updateArea } = useTableStore();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { if (open) { setName(initial?.name ?? ""); setErr(""); } }, [open, initial]);

  const save = async () => {
    if (!name.trim()) { setErr("Name is required"); return; }
    setSaving(true);
    try {
      if (initial) await updateArea(initial.id, { name: name.trim() });
      else await createArea({ name: name.trim() });
      onClose();
    } catch { setErr("Failed to save area"); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit Area" : "New Area"} size="sm">
      <div className="space-y-4">
        {err && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Area name *</label>
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Main Floor, Terrace, Bar" autoFocus
            onKeyDown={e => { if (e.key === "Enter") save(); }} />
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-60">
            {saving ? "Saving…" : initial ? "Update" : "Create Area"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Table Card ────────────────────────────────────────────────
function TableCard({ table, onQr, onStatus, onEdit, onDelete }: {
  table: Table;
  onQr: () => void;
  onStatus: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cfg = STATUS_CONFIG[table.status];
  return (
    <div className={`bg-white rounded-2xl border-2 ${cfg.border} overflow-hidden shadow-sm hover:shadow-md transition-shadow`}>
      {/* Status stripe */}
      <div className={`h-1.5 ${cfg.dot}`} />
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-2xl font-black text-slate-900">{table.number}</p>
            {table.name && <p className="text-xs text-slate-500 mt-0.5">{table.name}</p>}
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
          <span>👥 {table.capacity} seats</span>
          {table.areaName && <span>📍 {table.areaName}</span>}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={onStatus}
            className="py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition">
            Change status
          </button>
          <button onClick={onQr}
            className="py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium transition">
            📱 QR Code
          </button>
          <button onClick={onEdit}
            className="py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-medium transition">
            ✏️ Edit
          </button>
          <button onClick={onDelete}
            className="py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium transition">
            🗑️ Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function TablesPage() {
  const { areas, tables, isLoading, fetchAreas, fetchTables, updateStatus, deleteTable, deleteArea } = useTableStore();
  const [activeArea, setActiveArea] = useState<string | null>(null); // null = All

  const [qrTable, setQrTable] = useState<Table | null>(null);
  const [statusTable, setStatusTable] = useState<Table | null>(null);
  const [editTable, setEditTable] = useState<Table | null>(null);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [editArea, setEditArea] = useState<Area | null>(null);

  useEffect(() => {
    fetchAreas();
    fetchTables();
  }, [fetchAreas, fetchTables]);

  const displayedTables = activeArea
    ? tables.filter(t => t.areaId === activeArea)
    : tables;

  const statusSummary = {
    available: tables.filter(t => t.status === "available").length,
    occupied:  tables.filter(t => t.status === "occupied").length,
    reserved:  tables.filter(t => t.status === "reserved").length,
    cleaning:  tables.filter(t => t.status === "cleaning").length,
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tables</h1>
          <p className="text-sm text-slate-500 mt-0.5">{tables.length} tables · {areas.length} areas</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setEditArea(null); setAreaModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition">
            + Area
          </button>
          <button onClick={() => { setEditTable(null); setTableModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition shadow-sm">
            + Add Table
          </button>
        </div>
      </div>

      {/* Status summary */}
      {tables.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {(Object.entries(statusSummary) as [TableStatus, number][]).map(([status, count]) => {
            const cfg = STATUS_CONFIG[status];
            return (
              <button key={status} onClick={() => setActiveArea(null)}
                className={`rounded-xl border p-3 text-left transition ${cfg.bg} ${cfg.border}`}>
                <p className={`text-2xl font-bold ${cfg.text}`}>{count}</p>
                <p className={`text-xs ${cfg.text} opacity-80 mt-0.5`}>{cfg.label}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Area tabs */}
      {areas.length > 0 && (
        <div className="flex items-center gap-1.5 mb-5 overflow-x-auto pb-1">
          <button onClick={() => setActiveArea(null)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition ${activeArea === null ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            All tables
            <span className="ml-1.5 text-xs opacity-75">({tables.length})</span>
          </button>
          {areas.map(area => (
            <div key={area.id} className="shrink-0 flex items-center gap-0.5 group">
              <button onClick={() => setActiveArea(area.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${activeArea === area.id ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                {area.name}
                <span className="ml-1.5 text-xs opacity-75">({area.tableCount ?? 0})</span>
              </button>
              <button onClick={() => { setEditArea(area); setAreaModalOpen(true); }}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition text-xs">✏️</button>
              <button onClick={() => deleteArea(area.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition text-xs">🗑️</button>
            </div>
          ))}
        </div>
      )}

      {/* Tables grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({length: 8}).map((_,i) => <div key={i} className="bg-white rounded-2xl border border-slate-200 h-44 animate-pulse" />)}
        </div>
      ) : displayedTables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center text-4xl mb-5">🪑</div>
          <h3 className="font-semibold text-slate-900 mb-2 text-lg">No tables yet</h3>
          <p className="text-sm text-slate-500 mb-5 max-w-xs">
            {activeArea ? "No tables in this area. Create one or move existing tables here." : "Add your first table to start managing your floor plan."}
          </p>
          <button onClick={() => { setEditTable(null); setTableModalOpen(true); }}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium">
            + Add first table
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {displayedTables.map(table => (
            <TableCard
              key={table.id}
              table={table}
              onQr={() => setQrTable(table)}
              onStatus={() => setStatusTable(table)}
              onEdit={() => { setEditTable(table); setTableModalOpen(true); }}
              onDelete={() => deleteTable(table.id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <QrModal table={qrTable} open={!!qrTable} onClose={() => setQrTable(null)} />
      <StatusModal
        table={statusTable}
        open={!!statusTable}
        onClose={() => setStatusTable(null)}
        onSave={(status) => updateStatus(statusTable!.id, status)}
      />
      <TableFormModal
        open={tableModalOpen}
        onClose={() => { setTableModalOpen(false); setEditTable(null); }}
        areas={areas}
        initial={editTable}
      />
      <AreaFormModal
        open={areaModalOpen}
        onClose={() => { setAreaModalOpen(false); setEditArea(null); }}
        initial={editArea}
      />
    </div>
  );
}
