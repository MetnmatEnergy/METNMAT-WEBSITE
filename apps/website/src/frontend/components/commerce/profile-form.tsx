"use client";

import * as React from "react";
import { Loader2, Check } from "lucide-react";
import { Card } from "@/frontend/components/ui/card";
import { Button } from "@/frontend/components/ui/button";

const field =
  "w-full rounded-lg border border-input bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-ring/30 disabled:opacity-60";

type Initial = { name?: string; email?: string; phone?: string; company?: string; gstin?: string };

export function ProfileForm({ initial }: { initial: Initial }) {
  const [form, setForm] = React.useState({
    name: initial.name || "",
    phone: initial.phone || "",
    company: initial.company || "",
    gstin: initial.gstin || "",
  });
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setMsg(null);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      setMsg(res.ok && data?.success ? { ok: true, text: "Profile saved." } : { ok: false, text: data?.error || "Couldn't save." });
    } catch {
      setMsg({ ok: false, text: "Network error — please try again." });
    }
    setSaving(false);
  }

  return (
    <Card className="max-w-xl">
      <h2 className="font-display text-lg font-semibold">Profile</h2>
      <form onSubmit={save} className="mt-5 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Full name</span>
            <input className={field} value={form.name} onChange={set("name")} required />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Email</span>
            <input className={field} value={initial.email || ""} disabled title="Contact support to change your email" />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Phone</span>
            <input className={field} value={form.phone} onChange={set("phone")} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Company</span>
            <input className={field} value={form.company} onChange={set("company")} />
          </label>
        </div>
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">GSTIN (optional)</span>
          <input className={field} value={form.gstin} onChange={set("gstin")} placeholder="For GST invoices" />
        </label>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving} className="justify-self-start">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
          {msg && (
            <span className={`text-sm ${msg.ok ? "text-emerald-600" : "text-brand"}`}>{msg.text}</span>
          )}
        </div>
      </form>
    </Card>
  );
}
