"use client";

import { useEffect, useState } from "react";
import { useRestaurantStore } from "../../../store/restaurantStore";
import type { UpdateRestaurantDto, RestaurantSettings } from "@qr-saas/shared";

const inputCls = "w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400";

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-4 py-3">
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${checked ? "bg-indigo-600" : "bg-slate-200"}`}>
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-4 left-0.5" : "left-0.5"}`} />
      </button>
    </div>
  );
}

function SaveBar({ onSave, saving, dirty }: { onSave: () => void; saving: boolean; dirty: boolean }) {
  if (!dirty) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 px-5 py-3 bg-slate-900 rounded-2xl shadow-xl">
      <p className="text-sm text-slate-300">Unsaved changes</p>
      <button onClick={onSave} disabled={saving}
        className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium disabled:opacity-60 transition">
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

function ImageBox({ currentUrl, onUpload, label, wide }: {
  currentUrl?: string | null; onUpload: (f: File) => Promise<void>; label: string; wide?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const handle = async (file: File) => {
    const url = URL.createObjectURL(file);
    setPreview(url); setUploading(true);
    try { await onUpload(file); } finally { setUploading(false); URL.revokeObjectURL(url); }
  };
  return (
    <div>
      <p className="text-sm font-medium text-slate-700 mb-2">{label}</p>
      <label className={`relative flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50 cursor-pointer overflow-hidden transition ${wide ? "h-28 w-full" : "h-24 w-24"}`}>
        {preview
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
          : <div className="flex flex-col items-center gap-1 text-slate-400"><span className="text-2xl">📷</span><span className="text-xs">Upload</span></div>
        }
        {uploading && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /></div>}
        <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); }} />
      </label>
      <p className="text-xs text-slate-400 mt-1">JPG, PNG, WebP · 5 MB max</p>
    </div>
  );
}

const TIMEZONES = ["UTC","America/New_York","America/Chicago","America/Denver","America/Los_Angeles","America/Toronto","Europe/London","Europe/Paris","Europe/Berlin","Europe/Madrid","Asia/Dubai","Asia/Kolkata","Asia/Singapore","Asia/Tokyo","Australia/Sydney"];
const CURRENCIES = [{code:"USD",label:"USD — US Dollar"},{code:"EUR",label:"EUR — Euro"},{code:"GBP",label:"GBP — British Pound"},{code:"CAD",label:"CAD — Canadian Dollar"},{code:"AUD",label:"AUD — Australian Dollar"},{code:"INR",label:"INR — Indian Rupee"},{code:"AED",label:"AED — UAE Dirham"},{code:"SGD",label:"SGD — Singapore Dollar"},{code:"JPY",label:"JPY — Japanese Yen"}];

export default function SettingsPage() {
  const { restaurant, isLoading, fetch, update, uploadLogo, uploadCover } = useRestaurantStore();
  const [form, setForm] = useState<UpdateRestaurantDto & { name: string }>({ name:"", description:"", phone:"", email:"", currency:"USD", timezone:"UTC", taxRate:0, serviceCharge:0, address:{ street:"", city:"", state:"", country:"", postalCode:"" }, settings:{} });
  const [settings, setSettings] = useState<RestaurantSettings>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle"|"saved"|"error">("idle");

  useEffect(() => { fetch(); }, [fetch]);
  useEffect(() => {
    if (restaurant) {
      setForm({ name: restaurant.name, description: restaurant.description ?? "", phone: restaurant.phone ?? "", email: restaurant.email ?? "", currency: restaurant.currency, timezone: restaurant.timezone, taxRate: restaurant.taxRate, serviceCharge: restaurant.serviceCharge, address: restaurant.address ?? {}, settings: restaurant.settings });
      setSettings(restaurant.settings ?? {});
      setDirty(false);
    }
  }, [restaurant]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => { setForm(f => ({...f,[k]:v})); setDirty(true); };
  const setAddr = (k: string, v: string) => { setForm(f => ({...f, address:{...f.address,[k]:v}})); setDirty(true); };
  const setSetting = (k: keyof RestaurantSettings, v: boolean) => { const u={...settings,[k]:v}; setSettings(u); setForm(f=>({...f,settings:u})); setDirty(true); };

  const save = async () => {
    setSaving(true); setStatus("idle");
    try { await update(form); setDirty(false); setStatus("saved"); setTimeout(()=>setStatus("idle"),3000); }
    catch { setStatus("error"); } finally { setSaving(false); }
  };

  if (isLoading && !restaurant) return (
    <div className="max-w-3xl mx-auto space-y-4">{[...Array(3)].map((_,i)=><div key={i} className="bg-white rounded-2xl border h-48 animate-pulse"/>)}</div>
  );

  return (
    <div className="max-w-3xl mx-auto pb-24 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Restaurant Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your restaurant profile and preferences</p>
        </div>
        {status === "saved" && <span className="text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">✓ Saved</span>}
        {status === "error" && <span className="text-sm text-red-700 bg-red-50 px-3 py-1.5 rounded-full border border-red-200">✕ Failed to save</span>}
      </div>

      <Section title="Branding" description="Visual identity shown to your customers">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-6">
            <ImageBox currentUrl={restaurant?.logoUrl} onUpload={uploadLogo} label="Logo" />
            <ImageBox currentUrl={restaurant?.coverUrl} onUpload={uploadCover} label="Cover image" wide />
          </div>
          <Field label="Restaurant name"><input className={inputCls} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Your restaurant name" /></Field>
          <Field label="Description" hint="Shown on the customer-facing menu page">
            <textarea className={`${inputCls} resize-none`} rows={3} value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Tell customers about your restaurant…" />
          </Field>
        </div>
      </Section>

      <Section title="Contact Information">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone"><input className={inputCls} type="tel" value={form.phone} onChange={e=>set("phone",e.target.value)} placeholder="+1 (555) 000-0000" /></Field>
          <Field label="Email"><input className={inputCls} type="email" value={form.email} onChange={e=>set("email",e.target.value)} placeholder="hello@restaurant.com" /></Field>
          <div className="col-span-2"><Field label="Street address"><input className={inputCls} value={form.address?.street??""} onChange={e=>setAddr("street",e.target.value)} placeholder="123 Main St" /></Field></div>
          <Field label="City"><input className={inputCls} value={form.address?.city??""} onChange={e=>setAddr("city",e.target.value)} placeholder="New York" /></Field>
          <Field label="State"><input className={inputCls} value={form.address?.state??""} onChange={e=>setAddr("state",e.target.value)} placeholder="NY" /></Field>
          <Field label="Country"><input className={inputCls} value={form.address?.country??""} onChange={e=>setAddr("country",e.target.value)} placeholder="United States" /></Field>
          <Field label="Postal code"><input className={inputCls} value={form.address?.postalCode??""} onChange={e=>setAddr("postalCode",e.target.value)} placeholder="10001" /></Field>
        </div>
      </Section>

      <Section title="Localisation" description="Affects pricing display and order timestamps">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Currency">
            <select className={inputCls} value={form.currency} onChange={e=>set("currency",e.target.value)}>
              {CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Timezone">
            <select className={inputCls} value={form.timezone} onChange={e=>set("timezone",e.target.value)}>
              {TIMEZONES.map(tz=><option key={tz} value={tz}>{tz}</option>)}
            </select>
          </Field>
          <Field label="Tax rate" hint={`${((form.taxRate??0)*100).toFixed(0)}% applied to all orders`}>
            <input className={inputCls} type="number" step="0.01" min="0" max="1" value={form.taxRate} onChange={e=>set("taxRate",parseFloat(e.target.value)||0)} />
          </Field>
          <Field label="Service charge" hint={`${((form.serviceCharge??0)*100).toFixed(0)}% added at checkout`}>
            <input className={inputCls} type="number" step="0.01" min="0" max="1" value={form.serviceCharge} onChange={e=>set("serviceCharge",parseFloat(e.target.value)||0)} />
          </Field>
        </div>
      </Section>

      <Section title="Ordering Preferences">
        <div className="divide-y divide-slate-100">
          <Toggle label="Auto-confirm orders" description="Orders jump straight to Preparing without manual confirmation" checked={!!settings.autoConfirmOrders} onChange={v=>setSetting("autoConfirmOrders",v)} />
          <Toggle label="Require table confirmation" description="Staff must verify the diner's table before their order is accepted" checked={!!settings.requireTableConfirmation} onChange={v=>setSetting("requireTableConfirmation",v)} />
          <Toggle label="Allow scheduled orders" description="Diners can choose a future pickup or delivery time" checked={!!settings.allowScheduledOrders} onChange={v=>setSetting("allowScheduledOrders",v)} />
          <Toggle label="Kitchen printer" description="Send orders to a connected receipt printer automatically" checked={!!settings.kitchenPrinterEnabled} onChange={v=>setSetting("kitchenPrinterEnabled",v)} />
        </div>
      </Section>

      <Section title="Menu Display">
        <div className="divide-y divide-slate-100">
          <Toggle label="Show calorie counts" description="Display calories beside each menu item" checked={!!settings.showCalories} onChange={v=>setSetting("showCalories",v)} />
          <Toggle label="Show allergen information" description="Show allergen tags on menu items" checked={!!settings.showAllergens} onChange={v=>setSetting("showAllergens",v)} />
        </div>
      </Section>

      {restaurant && (
        <Section title="Subscription">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900 capitalize">
                {(restaurant as unknown as { planName?: string }).planName ?? "—"} Plan
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium border ${restaurant.subscriptionStatus==="trial"?"bg-yellow-100 text-yellow-700 border-yellow-200":restaurant.subscriptionStatus==="active"?"bg-green-100 text-green-700 border-green-200":"bg-red-100 text-red-700 border-red-200"}`}>
                  {restaurant.subscriptionStatus}
                </span>
              </p>
              {restaurant.trialEndsAt && restaurant.subscriptionStatus==="trial" && (
                <p className="text-xs text-slate-500 mt-0.5">Trial ends {new Date(restaurant.trialEndsAt).toLocaleDateString()}</p>
              )}
            </div>
            <button className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">Manage billing →</button>
          </div>
        </Section>
      )}

      <SaveBar onSave={save} saving={saving} dirty={dirty} />
    </div>
  );
}
