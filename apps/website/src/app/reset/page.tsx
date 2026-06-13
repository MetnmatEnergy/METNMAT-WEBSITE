"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";

const field =
  "w-full rounded-lg border border-input bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-ring/30";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  if (!token) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <h1 className="font-display text-xl font-bold">Invalid reset link</h1>
        <p className="mt-2 text-sm text-muted-foreground">This link is missing or has expired.</p>
        <Button href="/forgot" className="mt-6 w-full">Request a new link</Button>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/account/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        router.push("/account");
        router.refresh();
        return;
      }
      setError(data?.error || "Couldn't reset your password.");
    } catch {
      setError("Network error — please try again.");
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <h1 className="font-display text-xl font-bold">Set a new password</h1>
      <p className="mt-1 text-sm text-muted-foreground">Choose a strong password for your account.</p>
      <form onSubmit={submit} className="mt-6 grid gap-3">
        <input className={field} type="password" placeholder="New password (min 8 characters)" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} autoComplete="new-password" required />
        <input className={field} type="password" placeholder="Confirm new password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(""); }} autoComplete="new-password" required />
        {error && (
          <p className="rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 text-sm text-brand" role="alert">{error}</p>
        )}
        <Button type="submit" disabled={loading} className="mt-1 w-full" size="lg">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {loading ? "Saving…" : "Reset password"}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-semibold text-brand hover:underline">Back to sign in</Link>
      </p>
    </div>
  );
}

export default function ResetPage() {
  return (
    <Container className="py-12 sm:py-16">
      <React.Suspense fallback={<div className="mx-auto max-w-md text-center text-muted-foreground">Loading…</div>}>
        <ResetForm />
      </React.Suspense>
    </Container>
  );
}
