"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Copy, Pencil, X } from "lucide-react";
import { Card } from "@/frontend/components/ui/card";
import { Button } from "@/frontend/components/ui/button";
import { TextField, SelectField } from "@/frontend/components/ui/field";

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Role (optional)" },
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

const emptyFrom = (i: Initial) => ({
  name: i.name || "",
  phone: i.phone || "",
  company: i.company || "",
  gstin: i.gstin || "",
  role: i.role || "",
});

/** Read-only "label + value" row shown in view mode. */
function ViewRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="truncate text-sm text-foreground">{value ? value : <span className="text-muted-foreground">—</span>}</span>
    </div>
  );
}

export function ProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState(emptyFrom(initial));
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

  const displayName = (form.name || initial.name || initial.email || "").trim();
  const avatarInitial = displayName.charAt(0).toUpperCase() || "?";
  const roleLabel = form.role ? ROLE_OPTIONS.find((r) => r.value === form.role)?.label : undefined;

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

  function startEdit() {
    setForm(emptyFrom(initial));
    setNameError("");
    setMsg(null);
    setEditing(true);
  }

  function cancelEdit() {
    setForm(emptyFrom(initial));
    setNameError("");
    setMsg(null);
    setEditing(false);
  }

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
        setEditing(false);
        // Refresh server components (e.g. the account header "Signed in as") so an
        // updated name reflects immediately, not only after a hard reload.
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
        {!editing ? (
          <Button type="button" variant="outline" size="sm" onClick={startEdit} className="shrink-0">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        ) : null}
      </div>

      {/* Identity: avatar + permanent member id */}
      <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand/70 font-display text-lg font-bold text-white shadow-sm"
          >
            {avatarInitial}
          </span>
          <div className="min-w-0">
            {initial.userCode ? (
              <>
                <p className="text-xs text-muted-foreground">Member ID · permanent</p>
                <p className="truncate font-mono text-sm font-semibold tracking-wide text-foreground">
                  {initial.userCode}
                </p>
              </>
            ) : (
              <>
                <p className="truncate text-sm font-semibold text-foreground">{displayName || "Your account"}</p>
                <p className="truncate text-xs text-muted-foreground">{initial.email}</p>
              </>
            )}
          </div>
        </div>
        {initial.userCode ? (
          <button
            type="button"
            onClick={copyCode}
            aria-label="Copy member ID"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-input text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </button>
        ) : null}
      </div>

      {editing ? (
        <form onSubmit={save} noValidate className="mt-5 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Full name" value={form.name} onChange={set("name")} error={nameError} autoComplete="name" />
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
            <Button type="button" variant="ghost" onClick={cancelEdit} disabled={saving}>
              <X className="h-4 w-4" /> Cancel
            </Button>
            {msg && !msg.ok && (
              <span role="status" className="text-sm text-brand">
                {msg.text}
              </span>
            )}
          </div>
        </form>
      ) : (
        <div className="mt-5 grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <ViewRow label="Full name" value={form.name} />
            <ViewRow label="Email" value={initial.email} />
            <ViewRow label="Phone" value={form.phone} />
            <ViewRow label="Institution / Company" value={form.company} />
            <ViewRow label="Role" value={roleLabel} />
            <ViewRow label="GSTIN" value={form.gstin} />
          </div>
          {msg && msg.ok && (
            <span role="status" className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
              <Check className="h-4 w-4" /> {msg.text}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
