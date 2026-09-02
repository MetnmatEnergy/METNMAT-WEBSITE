"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";
import { TextField, SelectField, Label, FieldError, fieldClass } from "@/frontend/components/ui/field";
import { cn } from "@/frontend/lib/utils";

type Fields = Record<string, string>;
type Status = "idle" | "sending" | "sent" | "error";

/**
 * Kept short on purpose: a native <select> truncates its own label, and the
 * longer wording overflowed the control below ~390px. The full meaning of each
 * right is set out in section 8 of the privacy policy, which this page links to.
 */
const REQUEST_TYPES = [
  { value: "access", label: "Access my data" },
  { value: "correction", label: "Correct my data" },
  { value: "erasure", label: "Erase my data" },
  { value: "withdraw", label: "Withdraw consent" },
  { value: "nominate", label: "Nominate someone" },
  { value: "grievance", label: "Raise a grievance" },
];

/**
 * Data Principal rights request form (DPDP ss.11-14).
 *
 * On success it shows the reference the CMS minted, because that is what makes
 * the request followable — a "thanks, we got it" with no handle is not a
 * grievance-redressal mechanism.
 */
export function DataRequestForm() {
  const [status, setStatus] = React.useState<Status>("idle");
  const [fieldErrors, setFieldErrors] = React.useState<Fields>({});
  const [topError, setTopError] = React.useState("");
  const [reference, setReference] = React.useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setFieldErrors({});
    setTopError("");

    const fd = new FormData(e.currentTarget);
    const payload = {
      type: String(fd.get("type") ?? ""),
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim(),
      details: String(fd.get("details") ?? "").trim(),
      hp_company_url: String(fd.get("hp_company_url") ?? ""),
    };

    try {
      const res = await fetch("/api/privacy/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        reference?: string;
        fields?: Fields;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        if (json.fields) setFieldErrors(json.fields);
        /*
         * `json.error ?? ""` meant that whenever the body was not JSON, or was
         * JSON without an `error` key — a 502 from a proxy, a 429 whose shape
         * differs, an HTML error page — the form entered its error state and
         * displayed NOTHING. The submit button came back and the customer had no
         * idea why. Only a field-level error may leave the banner empty, because
         * in that case the message is on the field itself.
         */
        setTopError(
          json.error ||
            (json.fields
              ? ""
              : "We couldn't submit your request. Please try again, or email privacy@metnmat.com.")
        );
        setStatus("error");
        return;
      }
      setReference(json.reference ?? "");
      setStatus("sent");
    } catch {
      setTopError("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div
        role="status"
        className="rounded-2xl border border-border bg-surface p-6"
      >
        <CheckCircle2 aria-hidden className="h-6 w-6 text-brand-soft" />
        <h2 className="mt-3 font-display text-lg font-semibold">Request received</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Your reference is{" "}
          <strong className="font-semibold text-foreground">{reference}</strong>. Please keep it —
          quote it if you need to follow up.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          We may contact you to verify your identity before we act on the request. That step exists
          to stop somebody else obtaining or deleting your data.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <SelectField label="What would you like us to do?" name="type" defaultValue="access" error={fieldErrors.type}>
        {REQUEST_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </SelectField>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Your name" name="name" autoComplete="name" required error={fieldErrors.name} />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={fieldErrors.email}
          hint="We reply here, so use an address you can access."
        />
      </div>

      <TextField label="Phone (optional)" name="phone" type="tel" autoComplete="tel" error={fieldErrors.phone} />

      <div className="grid gap-1.5">
        <Label htmlFor="dpdp-details">Anything that helps us find your data (optional)</Label>
        <textarea
          id="dpdp-details"
          name="details"
          rows={5}
          maxLength={4000}
          className={cn(fieldClass, "h-auto py-2.5", fieldErrors.details && "border-brand focus:border-brand")}
          aria-invalid={fieldErrors.details ? true : undefined}
          aria-describedby={fieldErrors.details ? "dpdp-details-err" : undefined}
          placeholder="For example an order number, the email you used, or which data you mean."
        />
        {fieldErrors.details ? (
          <FieldError id="dpdp-details-err">{fieldErrors.details}</FieldError>
        ) : (
          <span className="text-xs text-muted-foreground">
            You do not have to give a reason for your request.
          </span>
        )}
      </div>

      {/* Honeypot — hidden from people, filled by bots. */}
      <div aria-hidden className="hidden">
        <label htmlFor="hp_company_url">Company URL</label>
        <input id="hp_company_url" name="hp_company_url" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {topError ? (
        <p role="alert" className="text-sm text-brand-soft">
          {topError}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Submitting…" : "Submit request"}
        </Button>
      </div>
    </form>
  );
}
