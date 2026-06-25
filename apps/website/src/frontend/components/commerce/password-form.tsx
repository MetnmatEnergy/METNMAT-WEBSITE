"use client";

import * as React from "react";
import { Loader2, Lock } from "lucide-react";
import { Card } from "@/frontend/components/ui/card";
import { Button } from "@/frontend/components/ui/button";

const field =
  "w-full rounded-lg border border-input bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-ring/30 disabled:opacity-60";

export function PasswordForm() {
  const [form, setForm] = React.useState({ current: "", next: "", confirm: "" });
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setMsg(null);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.next.length < 8) {
      setMsg({ ok: false, text: "New password must be at least 8 characters." });
      return;
    }
    if (form.next !== form.confirm) {
      setMsg({ ok: false, text: "New passwords don't match." });
      return;
    }
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
    <Card className="max-w-xl">
      <h2 className="font-display text-lg font-semibold">Change password</h2>
      <form onSubmit={submit} className="mt-5 grid gap-4">
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">Current password</span>
          <input
            type="password"
            autoComplete="current-password"
            className={field}
            value={form.current}
            onChange={set("current")}
            required
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">New password</span>
            <input
              type="password"
              autoComplete="new-password"
              className={field}
              value={form.next}
              onChange={set("next")}
              required
              minLength={8}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Confirm new password</span>
            <input
              type="password"
              autoComplete="new-password"
              className={field}
              value={form.confirm}
              onChange={set("confirm")}
              required
            />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving} className="justify-self-start">
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
