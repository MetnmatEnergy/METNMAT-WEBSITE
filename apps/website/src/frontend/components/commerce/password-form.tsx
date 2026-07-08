"use client";

import * as React from "react";
import { Loader2, Lock, Check, Circle } from "lucide-react";
import { Card } from "@/frontend/components/ui/card";
import { Button } from "@/frontend/components/ui/button";
import { PasswordField } from "@/frontend/components/ui/field";

function Requirement({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-2 text-xs transition-colors ${ok ? "text-emerald-600" : "text-muted-foreground"}`}>
      {ok ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Circle className="h-3.5 w-3.5 shrink-0 opacity-40" />}
      {children}
    </li>
  );
}

export function PasswordForm() {
  const [form, setForm] = React.useState({ current: "", next: "", confirm: "" });
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setMsg(null);
  };

  const lenOk = form.next.length >= 8;
  const diffOk = form.next.length > 0 && form.next !== form.current;
  const matchOk = form.next.length > 0 && form.next === form.confirm;
  const canSubmit = form.current.length > 0 && lenOk && diffOk && matchOk;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.current) return setMsg({ ok: false, text: "Enter your current password." });
    if (!lenOk) return setMsg({ ok: false, text: "New password must be at least 8 characters." });
    if (!diffOk) return setMsg({ ok: false, text: "New password must differ from your current one." });
    if (!matchOk) return setMsg({ ok: false, text: "New passwords don't match." });
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setMsg({ ok: true, text: "Password updated." });
        setForm({ current: "", next: "", confirm: "" });
      } else {
        setMsg({ ok: false, text: data?.error || "Couldn't update your password." });
      }
    } catch {
      setMsg({ ok: false, text: "Network error — please try again." });
    }
    setSaving(false);
  }

  return (
    <Card className="max-w-2xl">
      <h2 className="font-display text-lg font-semibold">Change password</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Use a strong password you don&apos;t reuse on other sites.
      </p>

      <form onSubmit={submit} noValidate className="mt-5 grid gap-4">
        <div className="sm:max-w-sm">
          <PasswordField
            label="Current password"
            value={form.current}
            onChange={set("current")}
            autoComplete="current-password"
            toggleLabel="current password"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <PasswordField
            label="New password"
            value={form.next}
            onChange={set("next")}
            autoComplete="new-password"
            toggleLabel="new password"
          />
          <PasswordField
            label="Confirm new password"
            value={form.confirm}
            onChange={set("confirm")}
            autoComplete="new-password"
            toggleLabel="confirmation"
            error={form.confirm.length > 0 && !matchOk ? "Passwords don't match." : undefined}
          />
        </div>

        <ul className="grid gap-1.5 rounded-lg border border-border bg-muted/30 p-3">
          <Requirement ok={lenOk}>At least 8 characters</Requirement>
          <Requirement ok={diffOk}>Different from your current password</Requirement>
          <Requirement ok={matchOk}>Both new passwords match</Requirement>
        </ul>

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={saving || !canSubmit} className="justify-self-start">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {saving ? "Updating…" : "Update password"}
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
