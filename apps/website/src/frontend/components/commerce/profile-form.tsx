"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Copy } from "lucide-react";
import { Card } from "@/frontend/components/ui/card";
import { Button } from "@/frontend/components/ui/button";
import { fieldClass } from "@/frontend/components/ui/field";

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Not set" },
  { value: "student", label: "Student" },
  { value: "phd", label: "PhD / Research Scholar" },
  { value: "faculty", label: "Faculty / Professor" },
  { value: "scientist", label: "Scientist / R&D" },
  { value: "procurement", label: "Institution / Procurement" },
  { value: "industry", label: "Industry" },
  { value: "other", label: "Other" },
];

type Initial = {
  userCode?: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  gstin?: string;
  role?: string;
};

export function ProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [form, setForm] = React.useState({
    name: initial.name || "",
    phone: initial.phone || "",
    company: initial.company || "",
    gstin: initial.gstin || "",
    role: initial.role || "",
  });
  const [saving, setSaving] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
      setMsg(null);
    };

  const copyCode = async () => {
    if (!initial.userCode) return;
    try {
      await navigator.clipboard.writeText(initial.userCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the code is on screen anyway */
    }
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
      if (res.ok && data?.success) {
        setMsg({ ok: true, text: "Profile saved." });
        // Refresh server components (e.g. the account layout header "Signed in as")
        // so an updated name reflects immediately, not only after a hard reload.
        router.refresh();
      } else {
        setMsg({ ok: false, text: data?.error || "Couldn't save." });
      }
    } catch {
      setMsg({ ok: false, text: "Network error — please try again." });
    }
    setSaving(false);
  }

  return (
    <Card className="max-w-xl">
      <h2 className="font-display text-lg font-semibold">Profile</h2>

      {initial.userCode ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Member ID</p>
            <p className="truncate font-mono text-sm font-semibold tracking-wide text-foreground">
              {initial.userCode}
            </p>
          </div>
          <button
            type="button"
            onClick={copyCode}
            aria-label="Copy member ID"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      ) : null}

      <form onSubmit={save} className="mt-5 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Full name</span>
            <input className={fieldClass} value={form.name} onChange={set("name")} required />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Email</span>
            <input
              className={fieldClass}
              value={initial.email || ""}
              disabled
              title="Contact support to change your email"
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Phone</span>
            <input className={fieldClass} value={form.phone} onChange={set("phone")} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Institution / Company</span>
            <input className={fieldClass} value={form.company} onChange={set("company")} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Role</span>
            <select
              className={`${fieldClass} cursor-pointer appearance-none pr-9`}
              value={form.role}
              onChange={set("role")}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">GSTIN (optional)</span>
            <input
              className={fieldClass}
              value={form.gstin}
              onChange={set("gstin")}
              placeholder="For GST invoices"
            />
          </label>
        </div>

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
