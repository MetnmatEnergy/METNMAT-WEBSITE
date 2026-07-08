"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Copy, BadgeCheck } from "lucide-react";
import { Card } from "@/frontend/components/ui/card";
import { Button } from "@/frontend/components/ui/button";
import { TextField, SelectField } from "@/frontend/components/ui/field";

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
  const [nameError, setNameError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
      if (k === "name") setNameError("");
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
    if (!form.name.trim()) {
      setNameError("Please enter your name.");
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, name: form.name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setMsg({ ok: true, text: "Profile saved." });
        // Refresh server components (e.g. the account layout header "Signed in as")
        // so an updated name reflects immediately, not only after a hard reload.
        router.refresh();
      } else {
        setMsg({ ok: false, text: data?.error || "Couldn't save your changes." });
      }
    } catch {
      setMsg({ ok: false, text: "Network error — please try again." });
    }
    setSaving(false);
  }

  return (
    <Card className="max-w-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Profile</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your details for orders, quotes &amp; GST invoices.
          </p>
        </div>
      </div>

      {initial.userCode ? (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand sm:flex">
              <BadgeCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Member ID · permanent</p>
              <p className="truncate font-mono text-sm font-semibold tracking-wide text-foreground">
                {initial.userCode}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={copyCode}
            aria-label="Copy member ID"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-input text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      ) : null}

      <form onSubmit={save} noValidate className="mt-5 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Full name"
            value={form.name}
            onChange={set("name")}
            error={nameError}
            autoComplete="name"
          />
          <TextField
            label="Email"
            labelHint="locked"
            value={initial.email || ""}
            disabled
            hint="Contact support to change your email."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Phone" value={form.phone} onChange={set("phone")} autoComplete="tel" inputMode="tel" />
          <TextField
            label="Institution / Company"
            value={form.company}
            onChange={set("company")}
            autoComplete="organization"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Role" value={form.role} onChange={set("role")}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </SelectField>
          <TextField
            label="GSTIN"
            labelHint="optional"
            value={form.gstin}
            onChange={set("gstin")}
            placeholder="For GST invoices"
          />
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving} className="justify-self-start">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
          {msg && (
            <span role="status" className={`text-sm ${msg.ok ? "text-emerald-600" : "text-brand"}`}>
              {msg.text}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}
