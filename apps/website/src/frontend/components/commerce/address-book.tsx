"use client";

import * as React from "react";
import { Loader2, Plus, Trash2, Check, MapPin } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";

type Address = {
  label?: string; line1?: string; line2?: string;
  city?: string; state?: string; pincode?: string; country?: string; isDefault?: boolean;
};

const field =
  "w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-ring/30";

export function AddressBook({ initial }: { initial: Address[] }) {
  const [addrs, setAddrs] = React.useState<Address[]>(initial?.length ? initial : []);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const upd = (i: number, k: keyof Address, v: string) => {
    setAddrs((a) => a.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));
    setMsg(null);
  };
  const setDefault = (i: number) => setAddrs((a) => a.map((x, idx) => ({ ...x, isDefault: idx === i })));
  const add = () => setAddrs((a) => [...a, { country: "India", isDefault: a.length === 0 }]);
  const remove = (i: number) => setAddrs((a) => a.filter((_, idx) => idx !== i));

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses: addrs }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setAddrs(data.addresses || []);
        setMsg({ ok: true, text: "Addresses saved." });
      } else {
        setMsg({ ok: false, text: data?.error || "Couldn't save." });
      }
    } catch {
      setMsg({ ok: false, text: "Network error — please try again." });
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      {addrs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
          <MapPin className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No saved addresses yet.</p>
        </div>
      )}

      {addrs.map((a, i) => (
        <div key={i} className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <input
              className={`${field} max-w-[220px] font-medium`}
              placeholder="Label (e.g. Office)"
              value={a.label || ""}
              onChange={(e) => upd(i, "label", e.target.value)}
            />
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="radio" name="default-address" checked={!!a.isDefault} onChange={() => setDefault(i)} />
                Default
              </label>
              <button type="button" onClick={() => remove(i)} aria-label="Remove address" className="text-muted-foreground hover:text-brand">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="grid gap-2.5">
            <input className={field} placeholder="Address line 1" value={a.line1 || ""} onChange={(e) => upd(i, "line1", e.target.value)} />
            <input className={field} placeholder="Address line 2 (optional)" value={a.line2 || ""} onChange={(e) => upd(i, "line2", e.target.value)} />
            <div className="grid gap-2.5 sm:grid-cols-3">
              <input className={field} placeholder="Town / City" value={a.city || ""} onChange={(e) => upd(i, "city", e.target.value)} />
              <input className={field} placeholder="State" value={a.state || ""} onChange={(e) => upd(i, "state", e.target.value)} />
              <input className={field} placeholder="PIN code / ZIP code" value={a.pincode || ""} onChange={(e) => upd(i, "pincode", e.target.value)} />
            </div>
            <input className={field} placeholder="Country" value={a.country || "India"} onChange={(e) => upd(i, "country", e.target.value)} />
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={add}>
          <Plus className="h-4 w-4" /> Add address
        </Button>
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {saving ? "Saving…" : "Save addresses"}
        </Button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-600" : "text-brand"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
