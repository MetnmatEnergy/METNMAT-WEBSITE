"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Check, Circle } from "lucide-react";
import { Card } from "@/frontend/components/ui/card";
import { Button } from "@/frontend/components/ui/button";
import { PasswordField } from "@/frontend/components/ui/field";
import { cn } from "@/frontend/lib/utils";

function Requirement({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={cn("flex items-center gap-2 text-xs transition-colors", ok ? "text-emerald-600" : "text-muted-foreground")}>
      {ok ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Circle className="h-3.5 w-3.5 shrink-0 opacity-40" />}
      {children}
    </li>
  );
}

/** 0–4, from length and character variety. Guidance only — the server is the gate. */
function strengthOf(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const STRENGTH = [
  { label: "", bar: "" },
  { label: "Weak", bar: "w-1/4 bg-brand" },
  { label: "Fair", bar: "w-2/4 bg-amber-500" },
  { label: "Good", bar: "w-3/4 bg-emerald-500" },
  { label: "Strong", bar: "w-full bg-emerald-600" },
] as const;

/**
 * Give a Google-created account its first password. Rendered two ways:
 *  - "onboarding" — the standalone /set-password step right after Google signup.
 *  - "settings"   — the profile card, for a customer who skipped it earlier.
 */
export function SetPasswordForm({
  email,
  next,
  mode,
}: {
  email: string;
  /** Where to go after success (onboarding only). */
  next?: string;
  mode: "onboarding" | "settings";
}) {
  const router = useRouter();
  const [pw, setPw] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const localPart = (email.split("@")[0] ?? "").toLowerCase();
  const lenOk = pw.length >= 8;
  const notEmailOk =
    pw.length > 0 && pw.toLowerCase() !== email.toLowerCase() && !(localPart.length >= 4 && pw.toLowerCase() === localPart);
  const matchOk = pw.length > 0 && pw === confirm;
  const canSubmit = lenOk && notEmailOk && matchOk && !saving;
  const strength = strengthOf(pw);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!lenOk) return setMsg({ ok: false, text: "Password must be at least 8 characters." });
    if (!notEmailOk) return setMsg({ ok: false, text: "Choose a password that isn't your email address." });
    if (!matchOk) return setMsg({ ok: false, text: "Passwords don't match." });

    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/account/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        if (mode === "onboarding") {
          router.push(next || "/account");
          router.refresh();
          return;
        }
        setMsg({ ok: true, text: "Password set. You can now sign in with your email or with Google." });
        setPw("");
        setConfirm("");
        setSaving(false);
        router.refresh(); // re-renders the profile with the normal change-password card
        return;
      }
      setMsg({ ok: false, text: data?.error || "Couldn't set your password." });
    } catch {
      setMsg({ ok: false, text: "Network error — please try again." });
    }
    setSaving(false);
  }

  const fields = (
    <form onSubmit={submit} noValidate className="mt-5 grid gap-4">
      {/* Username field: lets a password manager file the saved credential against
          the right account. Present in the DOM (managers skip display:none), but
          hidden from sight and from the tab order / a11y tree. */}
      <input
        type="text"
        name="email"
        autoComplete="username"
        value={email}
        readOnly
        aria-hidden
        tabIndex={-1}
        className="sr-only"
      />

      <div className={cn("grid gap-4", mode === "settings" && "sm:grid-cols-2")}>
        <PasswordField
          label="Password"
          value={pw}
          onChange={(e) => {
            setPw(e.target.value);
            setMsg(null);
          }}
          autoComplete="new-password"
          toggleLabel="password"
          placeholder="At least 8 characters"
        />
        <PasswordField
          label="Confirm password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            setMsg(null);
          }}
          autoComplete="new-password"
          toggleLabel="confirmation"
          error={confirm.length > 0 && !matchOk ? "Passwords don't match." : undefined}
        />
      </div>

      {/* Strength meter — advisory, announced politely rather than on every keypress. */}
      <div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full transition-all duration-300", STRENGTH[strength].bar)} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
          {pw ? `Password strength: ${STRENGTH[strength].label || "Weak"}` : " "}
        </p>
      </div>

      <ul className="grid gap-1.5 rounded-lg border border-border bg-muted/30 p-3">
        <Requirement ok={lenOk}>At least 8 characters</Requirement>
        <Requirement ok={notEmailOk}>Not your email address</Requirement>
        <Requirement ok={matchOk}>Both passwords match</Requirement>
      </ul>

      {msg && (
        <p
          role={msg.ok ? "status" : "alert"}
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            msg.ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600" : "border-brand/40 bg-brand/10 text-brand",
          )}
        >
          {msg.text}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="submit"
          disabled={!canSubmit}
          size={mode === "onboarding" ? "lg" : "md"}
          className={mode === "onboarding" ? "w-full sm:flex-1" : undefined}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {saving ? "Saving…" : mode === "onboarding" ? "Set password" : "Create password"}
        </Button>
        {mode === "onboarding" && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            disabled={saving}
            onClick={() => {
              router.push(next || "/account");
              router.refresh();
            }}
            className="w-full sm:w-auto"
          >
            Skip for now
          </Button>
        )}
      </div>
    </form>
  );

  if (mode === "settings") {
    return (
      <Card className="max-w-2xl">
        <h2 className="font-display text-lg font-semibold">Create a password</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          You signed up with Google, so your account doesn&apos;t have a password yet. Add one and you&apos;ll be able to
          sign in either way.
        </p>
        {fields}
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
        <Lock className="h-6 w-6" />
      </div>
      <h1 className="mt-4 font-display text-xl font-bold">Add a password</h1>
      {/* break-words: an email is one unbreakable word — a long academic address
          (dr.anita.rao.materials@iitbombay.ac.in) overflows the card on mobile. */}
      <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">
        Your account <span className="font-medium text-foreground/90">{email}</span> was created with Google. Set a
        password and you&apos;ll be able to sign in with either — whichever is handier.
      </p>
      {fields}
      <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
        You can always do this later from your profile. Continuing with Google will keep working either way.
      </p>
    </div>
  );
}
