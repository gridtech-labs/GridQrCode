"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "../../../store/authStore";
import api from "../../../lib/api";

interface StaffMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
  avatarUrl: string | null;
  createdAt: string;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  owner:   { label: "Owner",   color: "bg-purple-100 text-purple-700 border-purple-200" },
  manager: { label: "Manager", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  staff:   { label: "Staff",   color: "bg-sky-100 text-sky-700 border-sky-200" },
  kitchen: { label: "Kitchen", color: "bg-orange-100 text-orange-700 border-orange-200" },
};

function InviteModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => { if (open) { setEmail(""); setRole("staff"); setErr(""); setSent(false); } }, [open]);

  const send = async () => {
    if (!email.trim()) { setErr("Email is required"); return; }
    setSending(true); setErr("");
    try {
      await api.post("/staff/invite", { email: email.trim(), role });
      setSent(true);
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(msg ?? "Failed to send invitation");
    } finally { setSending(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Invite Team Member</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100">✕</button>
        </div>
        <div className="p-6 space-y-4">
          {sent ? (
            <div className="flex flex-col items-center py-4 gap-3">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">✉️</div>
              <p className="font-medium text-slate-900">Invitation sent!</p>
              <p className="text-sm text-slate-500 text-center">An email was sent to <strong>{email}</strong> with instructions to join.</p>
            </div>
          ) : (
            <>
              {err && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
                <input className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="team@restaurant.com"
                  onKeyDown={e => { if (e.key === "Enter") send(); }} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
                <select className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={role} onChange={e => setRole(e.target.value)}>
                  <option value="manager">Manager — Full access except billing</option>
                  <option value="staff">Staff — Orders, tables, and customers</option>
                  <option value="kitchen">Kitchen — Kitchen display only</option>
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                <button onClick={send} disabled={sending}
                  className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-60">
                  {sending ? "Sending…" : "Send invitation"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({ member }: { member: StaffMember }) {
  const initials = [member.firstName, member.lastName].filter(Boolean).map(n => n![0]).join("").toUpperCase() || member.email[0].toUpperCase();
  const colors = ["bg-indigo-500","bg-purple-500","bg-pink-500","bg-sky-500","bg-emerald-500","bg-orange-500"];
  const color = colors[initials.charCodeAt(0) % colors.length];
  if (member.avatarUrl) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={member.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
  );
  return <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center text-white text-sm font-semibold`}>{initials}</div>;
}

export default function StaffPage() {
  const { user } = useAuthStore();
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  const loadStaff = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get<{ data: { users: StaffMember[] } }>("/staff");
      setMembers(data.data.users);
    } catch {
      // Sprint 3 will have the full staff API — show placeholder for now
      setMembers([]);
    } finally { setIsLoading(false); }
  };

  useEffect(() => { loadStaff(); }, []);

  const canInvite = user?.role === "owner" || user?.role === "manager";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Team</h1>
          <p className="text-sm text-slate-500 mt-0.5">{members.length} member{members.length !== 1 ? "s" : ""}</p>
        </div>
        {canInvite && (
          <button onClick={() => setInviteOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition shadow-sm">
            + Invite member
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-slate-100">
            {[...Array(3)].map((_,i) => <div key={i} className="flex items-center gap-4 px-6 py-4"><div className="w-10 h-10 rounded-full bg-slate-100 animate-pulse"/><div className="flex-1 space-y-2"><div className="h-4 bg-slate-100 rounded w-48 animate-pulse"/><div className="h-3 bg-slate-100 rounded w-32 animate-pulse"/></div></div>)}
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mb-4">👥</div>
            <h3 className="font-semibold text-slate-900 mb-1">No team members yet</h3>
            <p className="text-sm text-slate-500 mb-4">Invite staff to give them access to the dashboard.</p>
            {canInvite && (
              <button onClick={() => setInviteOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium">
                + Invite first member
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {members.map(member => {
              const roleInfo = ROLE_LABELS[member.role] ?? { label: member.role, color: "bg-slate-100 text-slate-600 border-slate-200" };
              const isMe = member.id === user?.id;
              return (
                <div key={member.id} className="flex items-center gap-4 px-6 py-4">
                  <Avatar member={member} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 text-sm">
                        {[member.firstName, member.lastName].filter(Boolean).join(" ") || "—"}
                      </p>
                      {isMe && <span className="text-xs text-slate-400">(you)</span>}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{member.email}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${roleInfo.color}`}>{roleInfo.label}</span>
                  <p className="text-xs text-slate-400 hidden sm:block">
                    Joined {new Date(member.createdAt).toLocaleDateString()}
                  </p>
                  {canInvite && !isMe && (
                    <button className="text-xs text-slate-400 hover:text-red-600 transition px-2 py-1 rounded hover:bg-red-50">Remove</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
        <p className="text-sm font-medium text-amber-900 mb-1">Role permissions overview</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          {Object.entries(ROLE_LABELS).map(([role, info]) => (
            <div key={role} className="bg-white rounded-lg p-3 border border-amber-100">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${info.color} mb-2`}>{info.label}</span>
              <p className="text-xs text-slate-600">
                {role === "owner" && "Full access including billing"}
                {role === "manager" && "Manage menu, staff, and orders"}
                {role === "staff" && "Orders, tables, and customers"}
                {role === "kitchen" && "Kitchen display view only"}
              </p>
            </div>
          ))}
        </div>
      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} onSuccess={loadStaff} />
    </div>
  );
}
