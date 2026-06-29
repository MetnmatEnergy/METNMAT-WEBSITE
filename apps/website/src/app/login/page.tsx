"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";

const field =
  "w-full rounded-lg border border-input bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-ring/30";

/** Friendly copy for ?error= codes returned by the Google callback. */
const OAUTH_ERRORS: Record<string, string> = {
  google: "Google sign-in didn't complete. Please try again.",
  google_unavailable: "Google sign-in isn't available right now — please use email.",
  google_rate: "Too many attempts. Please wait a moment and try again.",
};

/** Official multi-colour Google "G". */
function GoogleG() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M17.64 9.2c0-.638-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.616z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58z" />
    </svg>
  );
}

/** Continue-with-Google button. A full navigation (not fetch) — OAuth needs a
 *  top-level redirect — carrying the post-login destination through. */
function GoogleButton({ redirectTo }: { redirectTo: string }) {
  return (
    <a
      href={`/api/account/google/start?redirect=${encodeURIComponent(redirectTo)}`}
      className="flex w-full items-center justify-center gap-3 rounded-lg border border-input bg-surface px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
    >
      <GoogleG />
      Continue with Google
    </a>
  );
}

function AuthCard() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") || "/account";
  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [form, setForm] = React.useState({ name: "", email: "", password: "", phone: "", company: "" });
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    // Typing means they're acting now — drop any stale error (e.g. a leftover
    // Google failure) so it doesn't make the email form look broken.
    setError((prev) => (prev ? "" : prev));
  };

  // Surface a Google sign-in failure passed back as ?error= by the callback,
  // then strip the param from the URL so it doesn't linger over the email form
  // or reappear on refresh.
  React.useEffect(() => {
    const code = params.get("error");
    if (!code) return;
    setError(OAUTH_ERRORS[code] || "Something went wrong. Please try again.");
    const next = new URLSearchParams(params.toString());
    next.delete("error");
    const qs = next.toString();
    router.replace(qs ? `/login?${qs}` : "/login", { scroll: false });
  }, [params, router]);

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

        <div className="mt-6">
          <GoogleButton redirectTo={redirectTo} />
        </div>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
          <span className="h-px flex-1 bg-border" />
          or {mode === "login" ? "sign in" : "sign up"} with email
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="grid gap-3">
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
