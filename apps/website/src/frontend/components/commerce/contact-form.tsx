"use client";

import * as React from "react";
import { Loader2, CheckCircle2, AlertCircle, Send } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";

const field =
  "w-full rounded-lg border border-input bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-ring/30";
const labelCls = "mb-1.5 block text-sm font-medium";
const errCls = "mt-1 text-xs font-medium text-red-500";

type Status = "idle" | "sending" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = React.useState<Status>("idle");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [topError, setTopError] = React.useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setFieldErrors({});
    setTopError("");

    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim(),
      company: String(fd.get("company") ?? "").trim(),
      message: String(fd.get("message") ?? "").trim(),
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setStatus("success");
        form.reset();
        return;
      }
      const data = await res.json().catch(() => null);
      if (res.status === 400 && data?.fields) {
        setFieldErrors(data.fields);
        setStatus("error");
        return;
      }
      setTopError(data?.error || "Something went wrong. Please try again or email us directly.");
      setStatus("error");
    } catch {
      setTopError("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface/60 px-6 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h3 className="mt-5 font-display text-xl font-semibold">Message sent</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Thank you for reaching out. The right person at METNMAT will get back to you shortly.
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-6" onClick={() => setStatus("idle")}>
          Send another message
        </Button>
      </div>
    );
  }

  const sending = status === "sending";

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {topError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2.5 text-sm text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{topError}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="cf-name">Name *</label>
          <input id="cf-name" name="name" className={field} placeholder="Your name" autoComplete="name" />
          {fieldErrors.name && <p className={errCls}>{fieldErrors.name}</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="cf-email">Email *</label>
          <input id="cf-email" name="email" type="email" className={field} placeholder="you@company.com" autoComplete="email" />
          {fieldErrors.email && <p className={errCls}>{fieldErrors.email}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="cf-phone">Phone</label>
          <input id="cf-phone" name="phone" className={field} placeholder="+91 …" autoComplete="tel" />
        </div>
        <div>
          <label className={labelCls} htmlFor="cf-company">Company</label>
          <input id="cf-company" name="company" className={field} placeholder="Company / institute" autoComplete="organization" />
        </div>
      </div>

      <div>
        <label className={labelCls} htmlFor="cf-message">Message *</label>
        <textarea id="cf-message" name="message" rows={5} className={field} placeholder="Tell us about your requirement or challenge…" />
        {fieldErrors.message && <p className={errCls}>{fieldErrors.message}</p>}
      </div>

      <Button type="submit" size="lg" disabled={sending} className="justify-self-start">
        {sending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Sending…
          </>
        ) : (
          <>
            <Send className="h-4 w-4" /> Send message
          </>
        )}
      </Button>
      <p className="text-xs text-muted-foreground">We typically reply within one business day.</p>
    </form>
  );
}
