"use client";

import { getTracker } from "@/frontend/lib/analytics/collector";
import * as React from "react";
import { Loader2, CheckCircle2, AlertCircle, Send } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";

const field =
  "w-full rounded-lg border border-input bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-ring/30";
const labelCls = "mb-1.5 block text-sm font-medium";
const errCls = "mt-1 text-xs font-medium text-red-500";

type Status = "idle" | "sending" | "success" | "error";

const CATEGORIES = ["R&D / consulting service", "Product / equipment", "Both"];

export function QuoteForm() {
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
    const category = String(fd.get("category") ?? "").trim();
    const details = String(fd.get("details") ?? "").trim();
    const payload = {
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim(),
      company: String(fd.get("company") ?? "").trim(),
      // The API validates on `message`; fold the category in so staff see it.
      message: category ? `Quote for: ${category}\n\n${details}` : details,
      hp_company_url: String(fd.get("hp_company_url") ?? ""), // honeypot (see hidden field)
    };

    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setStatus("success");
        getTracker().track("form_submit", { meta: { form: "quote" } });
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
        <h3 className="mt-5 font-display text-xl font-semibold">Quote request received</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Thanks — our team will scope it and get back to you, usually within one business day.
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-6" onClick={() => setStatus("idle")}>
          Submit another request
        </Button>
      </div>
    );
  }

  const sending = status === "sending";

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate data-analytics-form="quote">
      {/* Honeypot: hidden from humans + assistive tech; bots fill it and are rejected server-side. */}
      <input
        type="text"
        name="hp_company_url"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />
      {topError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2.5 text-sm text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{topError}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="qf-name">Name *</label>
          <input id="qf-name" name="name" className={field} placeholder="Your name" autoComplete="name" />
          {fieldErrors.name && <p className={errCls}>{fieldErrors.name}</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="qf-email">Email *</label>
          <input id="qf-email" name="email" type="email" className={field} placeholder="you@company.com" autoComplete="email" />
          {fieldErrors.email && <p className={errCls}>{fieldErrors.email}</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="qf-phone">Phone</label>
          <input id="qf-phone" name="phone" className={field} placeholder="+91 …" autoComplete="tel" />
        </div>
        <div>
          <label className={labelCls} htmlFor="qf-company">Company</label>
          <input id="qf-company" name="company" className={field} placeholder="Company / institute" autoComplete="organization" />
        </div>
      </div>

      <div>
        <label className={labelCls} htmlFor="qf-category">What do you need a quote for?</label>
        <select id="qf-category" name="category" className={field} defaultValue="">
          <option value="" disabled>Select an option</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls} htmlFor="qf-details">Details *</label>
        <textarea
          id="qf-details"
          name="details"
          rows={6}
          className={field}
          placeholder="Describe your process, goals, quantities, timelines…"
        />
        {fieldErrors.message && <p className={errCls}>{fieldErrors.message}</p>}
      </div>

      <Button type="submit" size="lg" disabled={sending} className="justify-self-start">
        {sending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
          </>
        ) : (
          <>
            <Send className="h-4 w-4" /> Submit request
          </>
        )}
      </Button>
      <p className="text-xs text-muted-foreground">We typically reply within one business day.</p>
    </form>
  );
}
