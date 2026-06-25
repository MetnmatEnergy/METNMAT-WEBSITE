"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";

const field =
  "w-full rounded-lg border border-input bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-ring/30";

function AuthCard() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") || "/account";
  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [form, setForm] = React.useState({ name: "", email: "", password: "", phone: "", company: "" });
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const endpoint = mode === "login" ? "/api/account/login" : "/api/account/register";
    const payload =
      mode === "login"
        ? { email: form.email, password: form.password }
        : form;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        router.push(redirectTo);
        router.refresh();
        return;
      }
      setError(data?.error || "Something went wrong. Please try again.");
    } catch {
      setError("Network error — please try again.");
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/40 p-1 text-sm font-medium">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(""); }}
              className={`rounded-lg py-2 transition-colors ${
                mode === m ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <h1 className="mt-6 font-display text-xl font-bold">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "login"
            ? "Sign in to track orders, RFQs, and saved addresses."
            : "One account for orders, quote requests, and faster checkout."}
        </p>

        <form onSubmit={submit} className="mt-6 grid gap-3">
          {mode === "register" && (
            <input className={field} placeholder="Full name" value={form.name} onChange={set("name")} autoComplete="name" required />
          )}
          <input className={field} type="email" placeholder="Email" value={form.email} onChange={set("email")} autoComplete="email" required />
          <input
            className={field}
            type="password"
            placeholder={mode === "register" ? "Password (min 8 characters)" : "Password"}
            value={form.password}
            onChange={set("password")}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />
          {mode === "login" && (
            <div className="-mt-1 text-right">
              <Link href="/forgot" className="text-xs font-medium text-brand hover:underline">
                Forgot password?
              </Link>
            </div>
          )}
          {mode === "register" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={field} placeholder="Phone (optional)" value={form.phone} onChange={set("phone")} autoComplete="tel" />
              <input className={field} placeholder="Company (optional)" value={form.company} onChange={set("company")} autoComplete="organization" />
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 text-sm text-brand" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="mt-1 w-full" size="lg">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "login" ? "New to METNMAT? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            className="font-semibold text-brand hover:underline"
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        An account keeps your orders, GST invoices &amp; saved addresses in one place — and makes
        checkout a few taps next time.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Container className="py-12 sm:py-16">
      <React.Suspense fallback={<div className="mx-auto max-w-md text-center text-muted-foreground">Loading…</div>}>
        <AuthCard />
      </React.Suspense>
    </Container>
  );
}
