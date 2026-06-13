"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";

const field =
  "w-full rounded-lg border border-input bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-ring/30";

export default function ForgotPage() {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/account/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) setSent(true);
      else setError("Something went wrong. Please try again.");
    } catch {
      setError("Network error — please try again.");
    }
    setLoading(false);
  }

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        {sent ? (
          <div className="text-center">
            <MailCheck className="mx-auto h-9 w-9 text-brand" />
            <h1 className="mt-4 font-display text-xl font-bold">Check your email</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              If an account exists for <span className="font-medium text-foreground/90">{email}</span>, we&apos;ve
              sent a link to reset your password. It expires in 1 hour.
            </p>
            <Button href="/login" className="mt-6 w-full">Back to sign in</Button>
          </div>
        ) : (
          <>
            <h1 className="font-display text-xl font-bold">Forgot your password?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your email and we&apos;ll send you a link to reset it.
            </p>
            <form onSubmit={submit} className="mt-6 grid gap-3">
              <input
                className={field}
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                autoComplete="email"
                required
              />
              {error && (
                <p className="rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 text-sm text-brand" role="alert">{error}</p>
              )}
              <Button type="submit" disabled={loading} className="mt-1 w-full" size="lg">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? "Sending…" : "Send reset link"}
              </Button>
            </form>
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Remembered it?{" "}
              <Link href="/login" className="font-semibold text-brand hover:underline">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </Container>
  );
}
