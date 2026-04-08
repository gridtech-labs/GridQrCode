"use client";

import { useEffect, useState, useRef } from "react";
import { useMenuStore } from "../../../store/menuStore";
import type { MenuCategory, MenuItem, CreateMenuItemDto } from "@qr-saas/shared";

// ── UI Primitives ─────────────────────────────────────────────

function Modal({ open, onClose, title, children, size = "md" }: {
  open: boolean; onClose: () => void; title: string;
  children: React.ReactNode; size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  if (!open) return null;
  const w = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${w} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = "Delete", variant = "danger" }: {
  open: boolean; onClose: () => void; onConfirm: () => void | Promise<void>;
  title: string; description: string; confirmLabel?: string; variant?: "danger" | "warning";
}) {
  const [loading, setLoading] = useState(false);
  const handle = async () => { setLoading(true); try { await onConfirm(); onClose(); } finally { setLoading(false); } };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl mb-4 ${variant === "danger" ? "bg-red-100" : "bg-yellow-100"}`}>
          {variant === "danger" ? "🗑️" : "⚠️"}
        </div>
        <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 mb-6">{description}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={handle} disabled={loading}
            className={`flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60 ${variant === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-yellow-500 hover:bg-yellow-600"}`}>
            {loading ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400";

// ── Image Upload ──────────────────────────────────────────────

function ImageUpload({ currentUrl, onUpload, label, wide }: {
  currentUrl?: string | null; onUpload: (f: File) => Promise<void>; label: string; wide?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);

  const handle = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    setUploading(true);
    try { await onUpload(file); } finally { setUploading(false); URL.revokeObjectURL(url); }
  };

  return (
    <div>
      <p className="text-sm font-medium text-slate-700 mb-2">{label}</p>
      <div
        className={`relative rounded-xl border-2 border-dashed border-slate-200 hover:border-slate-300 bg-slate-50 cursor-pointer transition ${wide ? "h-28 w-full" : "h-28 w-28"}`}
        onClick={() => ref.current?.click()}
      >
        {preview
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover rounded-xl" />
          : <div className="absolute inset-0 flex flex-col items-center justify-center gap-1"><span className="text-2xl text-slate-300">📷</span><span className="text-xs text-slate-400">Upload</span></div>
        }
        {uploading && (
          <div className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }} />
      <p className="text-xs text-slate-400 mt-1">JPG, PNG or WebP · Max 5 MB</p>
    </div>
  );
}

// ── Category Form ─────────────────────────────────────────────

function CategoryModal({ open, onClose, initial }: {
  open: boolean; onClose: () => void; initial?: MenuCategory | null;
}) {
  const { createCategory, updateCategory } = useMenuStore();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) { setName(initial?.name ?? ""); setDesc(initial?.description ?? ""); setErr(""); }
  }, [open, initial]);

  const save = async () => {
    if (!name.trim()) { setErr("Name is required"); return; }
    setSaving(true);
    try {
      if (initial) await updateCategory(initial.id, { name: name.trim(), description: desc.trim() || undefined });
      else await createCategory({ name: name.trim(), description: desc.trim() || undefined });
      onClose();
    } catch { setErr("Failed to save"); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit Category" : "New Category"} size="sm">
      <div className="space-y-4">
        <Field label="Name *" error={err}><input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Starters" /></Field>
        <Field label="Description"><textarea className={`${inputCls} resize-none`} rows={2} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional" /></Field>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-60">
            {saving ? "Saving…" : initial ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Item Form ─────────────────────────────────────────────────

function ItemModal({ open, onClose, initial, categories }: {
  open: boolean; onClose: () => void; initial?: MenuItem | null; categories: MenuCategory[];
}) {
  const { createItem, updateItem } = useMenuStore();
  const blank = { name: "", description: "", price: "" as unknown as number, categoryId: "", tags: [] as string[], prepTimeMin: 10, isFeatured: false };
  const [f, setF] = useState(blank);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (open) {
      setF({
        name: initial?.name ?? "",
        description: initial?.description ?? "",
        price: initial?.price ?? ("" as unknown as number),
        categoryId: initial?.categoryId ?? "",
        tags: initial?.tags ?? [],
        prepTimeMin: initial?.prepTimeMin ?? 10,
        isFeatured: initial?.isFeatured ?? false,
      });
      setErrs({}); setTagInput("");
    }
  }, [open, initial]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = "Required";
    if (!f.price || Number(f.price) <= 0) e.price = "Must be positive";
    setErrs(e);
    return !Object.keys(e).length;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const dto = { ...f, price: Number(f.price), categoryId: f.categoryId || undefined };
      if (initial) await updateItem(initial.id, dto);
      else await createItem(dto as CreateMenuItemDto);
      onClose();
    } catch { setErrs({ _: "Failed to save" }); } finally { setSaving(false); }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !f.tags.includes(t)) { setF(x => ({ ...x, tags: [...x.tags, t] })); setTagInput(""); }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit Item" : "New Menu Item"} size="lg">
      <div className="space-y-4">
        {errs._ && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errs._}</p>}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Name *" error={errs.name}>
              <input className={inputCls} value={f.name} onChange={e => setF(x => ({ ...x, name: e.target.value }))} placeholder="e.g. Margherita Pizza" />
            </Field>
          </div>
          <Field label="Price *" error={errs.price}>
            <input className={inputCls} type="number" step="0.01" min="0" value={f.price} onChange={e => setF(x => ({ ...x, price: e.target.value as unknown as number }))} placeholder="0.00" />
          </Field>
          <Field label="Prep time (min)">
            <input className={inputCls} type="number" min="0" value={f.prepTimeMin} onChange={e => setF(x => ({ ...x, prepTimeMin: +e.target.value }))} />
          </Field>
        </div>

        <Field label="Description">
          <textarea className={`${inputCls} resize-none`} rows={2} value={f.description} onChange={e => setF(x => ({ ...x, description: e.target.value }))} placeholder="Describe the item…" />
        </Field>

        <Field label="Category">
          <select className={inputCls} value={f.categoryId} onChange={e => setF(x => ({ ...x, categoryId: e.target.value }))}>
            <option value="">— No category —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>

        <div>
          <p className="text-sm font-medium text-slate-700 mb-1.5">Tags</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {f.tags.map(t => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs border border-indigo-200">
                {t}<button onClick={() => setF(x => ({ ...x, tags: x.tags.filter(tt => tt !== t) }))} className="hover:text-indigo-900 ml-0.5">✕</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              placeholder="Add tag (Enter)" className={`${inputCls} flex-1`} />
            <button onClick={addTag} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm hover:bg-slate-200">Add</button>
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <div onClick={() => setF(x => ({ ...x, isFeatured: !x.isFeatured }))}
            className={`w-10 h-6 rounded-full transition-colors ${f.isFeatured ? "bg-indigo-600" : "bg-slate-200"}`}>
            <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-transform ${f.isFeatured ? "translate-x-4 ml-0.5" : "translate-x-0.5"}`} />
          </div>
          <span className="text-sm text-slate-700">Featured item</span>
        </label>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-60">
            {saving ? "Saving…" : initial ? "Update" : "Create Item"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Item Card ─────────────────────────────────────────────────

function ItemCard({ item, onEdit, onDelete, onToggle, onImage }: {
  item: MenuItem; onEdit: () => void; onDelete: () => void;
  onToggle: () => void; onImage: (f: File) => Promise<void>;
}) {
  const [showImg, setShowImg] = useState(false);
  return (
    <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden transition-shadow hover:shadow-md ${!item.isAvailable ? "opacity-60" : ""}`}>
      <div className="relative h-36 bg-slate-100 cursor-pointer group" onClick={() => setShowImg(v => !v)}>
        {item.imageUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
          : <div className="flex items-center justify-center h-full"><span className="text-4xl text-slate-200">🍽️</span></div>
        }
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition flex items-center justify-center">
          <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100">Change photo</span>
        </div>
        {item.isFeatured && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium border border-yellow-200">⭐ Featured</span>
        )}
      </div>

      {showImg && (
        <div className="px-3 pt-3">
          <ImageUpload currentUrl={item.imageUrl} onUpload={async f => { await onImage(f); setShowImg(false); }} label="New photo" wide />
        </div>
      )}

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 text-sm truncate">{item.name}</p>
            {item.categoryName && <p className="text-xs text-slate-400">{item.categoryName}</p>}
          </div>
          <p className="font-bold text-slate-900 text-sm shrink-0">{Number(item.price).toFixed(2)}</p>
        </div>
        {item.description && <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{item.description}</p>}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.tags.slice(0, 3).map(t => <span key={t} className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{t}</span>)}
            {item.tags.length > 3 && <span className="text-xs text-slate-400">+{item.tags.length - 3}</span>}
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100">
          <button onClick={onToggle}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${item.isAvailable ? "bg-green-50 text-green-700 hover:bg-green-100" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            {item.isAvailable ? "● Available" : "○ Hidden"}
          </button>
          <button onClick={onEdit} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition">✏️</button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition">🗑️</button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function MenuPage() {
  const { categories, items, isLoading, fetchCategories, fetchItems, deleteItem, toggleItem, uploadItemImage, deleteCategory } = useMenuStore();
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [catModal, setCatModal] = useState(false);
  const [editCat, setEditCat] = useState<MenuCategory | null>(null);
  const [delCat, setDelCat] = useState<MenuCategory | null>(null);
  const [itemModal, setItemModal] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [delItem, setDelItem] = useState<MenuItem | null>(null);

  useEffect(() => { fetchCategories(); fetchItems(); }, [fetchCategories, fetchItems]);

  const filtered = items.filter(i => {
    if (activeCat && i.categoryId !== activeCat) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !i.description?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Menu</h1>
          <p className="text-sm text-slate-500 mt-0.5">{items.length} items · {categories.length} categories</p>
        </div>
        <button onClick={() => { setEditItem(null); setItemModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition shadow-sm">
          + Add Item
        </button>
      </div>

      <div className="flex gap-5">
        {/* Sidebar */}
        <aside className="w-52 shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden sticky top-6">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Categories</p>
              <button onClick={() => { setEditCat(null); setCatModal(true); }}
                className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 text-sm font-bold">+</button>
            </div>
            <nav className="p-2 space-y-0.5">
              <button onClick={() => setActiveCat(null)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${activeCat === null ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-600 hover:bg-slate-50"}`}>
                <span>All items</span>
                <span className="text-xs text-slate-400">{items.length}</span>
              </button>
              {categories.map(cat => (
                <div key={cat.id} className="group relative">
                  <button onClick={() => setActiveCat(cat.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${activeCat === cat.id ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-600 hover:bg-slate-50"}`}>
                    <span className="truncate pr-8">{cat.name}</span>
                    <span className="text-xs text-slate-400">{cat.itemCount ?? 0}</span>
                  </button>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-0.5">
                    <button onClick={e => { e.stopPropagation(); setEditCat(cat); setCatModal(true); }}
                      className="p-1 rounded bg-white shadow text-slate-400 hover:text-indigo-600 text-xs">✏️</button>
                    <button onClick={e => { e.stopPropagation(); setDelCat(cat); }}
                      className="p-1 rounded bg-white shadow text-slate-400 hover:text-red-600 text-xs">🗑️</button>
                  </div>
                </div>
              ))}
              {categories.length === 0 && <p className="text-xs text-slate-400 text-center py-3 px-2">No categories yet</p>}
            </nav>
          </div>
        </aside>

        {/* Items */}
        <div className="flex-1 min-w-0">
          <div className="mb-4">
            <input type="text" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full max-w-xs px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="bg-white rounded-xl border border-slate-200 h-56 animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mb-4">🍽️</div>
              <h3 className="font-semibold text-slate-900 mb-1">{search ? "No items found" : "No menu items yet"}</h3>
              <p className="text-sm text-slate-500 mb-4 max-w-xs">{search ? `No results for "${search}"` : "Add your first item to start building your menu."}</p>
              {!search && <button onClick={() => { setEditItem(null); setItemModal(true); }}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium">+ Add first item</button>}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map(item => (
                <ItemCard key={item.id} item={item}
                  onEdit={() => { setEditItem(item); setItemModal(true); }}
                  onDelete={() => setDelItem(item)}
                  onToggle={() => toggleItem(item.id)}
                  onImage={f => uploadItemImage(item.id, f)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CategoryModal open={catModal} onClose={() => { setCatModal(false); setEditCat(null); }} initial={editCat} />
      <ItemModal open={itemModal} onClose={() => { setItemModal(false); setEditItem(null); }} initial={editItem} categories={categories} />
      <ConfirmDialog open={!!delItem} onClose={() => setDelItem(null)} onConfirm={() => deleteItem(delItem!.id)}
        title={`Delete "${delItem?.name}"?`} description="This permanently removes the item." />
      <ConfirmDialog open={!!delCat} onClose={() => setDelCat(null)} onConfirm={() => deleteCategory(delCat!.id)}
        title={`Delete "${delCat?.name}"?`} description="Items inside will become uncategorised." variant="warning" />
    </div>
  );
}
