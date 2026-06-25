"use client";

import * as React from "react";
import { Loader2, CheckCircle2, AlertCircle, Send } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";

const field =
  "w-full rounded-lg border border-input bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-ring/30 aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-500/30";
const labelCls = "mb-1.5 block text-sm font-medium";
const errCls = "mt-1 text-xs font-medium text-red-500";

type Status = "idle" | "sending" | "success" | "error";
type Fields = Record<string, string>;

// Mirror of the server rules (backend/validation) for instant inline feedback;
// the server stays the source of truth and re-validates every submission.
function validate(p: { name: string; email: string; message: string }): Fields {
  const f: Fields = {};
  if (p.name.length < 2) f.name = "Please enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) f.email = "Please enter a valid email.";
  if (p.message.length < 5) f.message = "Please add a few more details.";
  return f;
}

export function ContactForm() {
  const [status, setStatus] = React.useState<Status>("idle");
  const [fieldErrors, setFieldErrors] = React.useState<Fields>({});
  const [topError, setTopError] = React.useState("");
  const formRef = React.useRef<HTMLFormElement>(null);
  const successRef = React.useRef<HTMLDivElement>(null);

  // Move focus to the first field with an error (keyboard + screen-reader UX).
  const focusFirstError = React.useCallback((errs: Fields) => {
    const first = ["name", "email", "message"].find((k) => errs[k]);
    const el = first ? (formRef.current?.elements.namedItem(first) as HTMLElement | null) : null;
    el?.focus();
  }, []);

  // Clear a single field's error as soon as the user edits it.
  const clearFieldError = (name: string) =>
    setFieldErrors((prev) => {
      if (!prev[name]) return prev; // no-op (and no re-render) when nothing to clear
      const next = { ...prev };
      delete next[name];
      return next;
    });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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

    // Validate client-side first — instant feedback, and avoids a round-trip.
    const clientErrors = validate(payload);
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setStatus("error");
      focusFirstError(clientErrors);
      return;
    }

    setStatus("sending");
    setFieldErrors({});

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
        focusFirstError(data.fields);
        return;
      }
      setTopError(
        res.status === 429
          ? data?.error || "Too many requests. Please wait a moment and try again."
          : data?.error || "Something went wrong. Please try again or email us directly."
      );
      setStatus("error");
    } catch {
      setTopError("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  }

  // Move focus to the confirmation when the message is sent (so it's announced).
  React.useEffect(() => {
    if (status === "success") successRef.current?.focus();
  }, [status]);

  if (status === "success") {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface/60 px-6 py-16 text-center outline-none"
      >
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

  // a11y wiring for a field: mark invalid and point to its error message.
  const errProps = (name: string) =>
    fieldErrors[name]
      ? { "aria-invalid": true as const, "aria-describedby": `cf-${name}-err` }
      : {};

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-4" noValidate>
      {topError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2.5 text-sm text-red-600"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{topError}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="cf-name">Name *</label>
          <input
            id="cf-name"
            name="name"
            className={field}
            placeholder="Your name"
            autoComplete="name"
            required
            maxLength={100}
            onInput={() => clearFieldError("name")}
            {...errProps("name")}
          />
          {fieldErrors.name && (
            <p id="cf-name-err" className={errCls}>
              {fieldErrors.name}
            </p>
          )}
        </div>
        <div>
          <label className={labelCls} htmlFor="cf-email">Email *</label>
          <input
            id="cf-email"
            name="email"
            type="email"
            className={field}
            placeholder="you@company.com"
            autoComplete="email"
            required
            maxLength={150}
            onInput={() => clearFieldError("email")}
            {...errProps("email")}
          />
          {fieldErrors.email && (
            <p id="cf-email-err" className={errCls}>
              {fieldErrors.email}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="cf-phone">Phone</label>
          <input
            id="cf-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            className={field}
            placeholder="+91 …"
            autoComplete="tel"
            maxLength={30}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="cf-company">Company</label>
          <input
            id="cf-company"
            name="company"
            className={field}
            placeholder="Company / institute"
            autoComplete="organization"
            maxLength={150}
          />
        </div>
      </div>

      <div>
        <label className={labelCls} htmlFor="cf-message">Message *</label>
        <textarea
          id="cf-message"
          name="message"
          rows={5}
          className={field}
          placeholder="Tell us about your requirement or challenge…"
          required
          maxLength={4000}
          onInput={() => clearFieldError("message")}
          {...errProps("message")}
        />
        {fieldErrors.message && (
          <p id="cf-message-err" className={errCls}>
            {fieldErrors.message}
          </p>
        )}
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
