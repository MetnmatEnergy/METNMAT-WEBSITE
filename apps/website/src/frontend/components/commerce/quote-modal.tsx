"use client";

import { getTracker } from "@/frontend/lib/analytics/collector";
import * as React from "react";
import { X, Check, Send, Loader2, Mail, Minus, Plus } from "lucide-react";
import { useQuote } from "@/frontend/components/commerce/quote-provider";
import {
  AttachmentUploader,
  type UploadItem,
} from "@/frontend/components/commerce/attachment-uploader";

const field =
  "w-full rounded-xl border border-input bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-ring/30";
const labelCls = "mb-1.5 block text-sm font-medium";

const QTY_MIN = 1;
const QTY_MAX = 100000;

export function QuoteModal() {
  const { modalOpen, closeModal } = useQuote();
  const [status, setStatus] = React.useState<"idle" | "sending" | "error">("idle");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [thankYou, setThankYou] = React.useState(false);
  const [emailed, setEmailed] = React.useState(false);
  const [qty, setQty] = React.useState(1);
  const [attachments, setAttachments] = React.useState<UploadItem[]>([]);
  const formRef = React.useRef<HTMLFormElement>(null);

  const uploading = attachments.some((a) => a.status === "uploading");

  React.useEffect(() => {
    if (modalOpen) {
      setStatus("idle");
      setErrors({});
      setQty(1);
      setAttachments([]);
      formRef.current?.reset();
    }
  }, [modalOpen]);

  React.useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeModal();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [modalOpen, closeModal]);

  function setQtyClamped(v: number) {
    if (Number.isNaN(v)) return setQty(QTY_MIN);
    setQty(Math.min(QTY_MAX, Math.max(QTY_MIN, Math.round(v))));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (uploading) return;
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "").trim();

    const name = get("name");
    const email = get("email");
    const mobile = get("mobile");
    const inquiry = get("inquiry");
    const sizeValue = get("sizeValue");
    const sizeUnit = get("sizeUnit");
    const size = sizeValue ? `${sizeValue} ${sizeUnit}` : "";
    const quantity = String(qty);

    const errs: Record<string, string> = {};
    if (name.length < 2) errs.name = "Please enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email.";
    if (mobile.replace(/\D/g, "").length < 10) errs.mobile = "Enter a valid mobile number.";
    if (inquiry.length < 3) errs.inquiry = "Please describe your requirement.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const done = attachments.filter((a) => a.status === "done" && a.id);
    const attachmentIds = done.map((a) => a.id as string);
    const attachmentNames = done.map((a) => a.name);

    const message = [
      "General enquiry / quote request",
      `Requirement: ${inquiry}`,
      `Application / industry: ${get("application") || "—"}`,
      `Size: ${size || "—"}`,
      `Material: ${get("material") || "—"}`,
      `Quantity: ${quantity}`,
      attachmentNames.length ? `Attachments: ${attachmentNames.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    setStatus("sending");
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone: mobile,
          company: get("company"),
          message,
          design: inquiry,
          size,
          material: get("material"),
          quantity,
          attachmentIds,
          attachmentNames,
        }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setEmailed(Boolean(data?.emailed));
      setStatus("idle");
      closeModal();
      setThankYou(true);
      getTracker().track("form_submit", { meta: { form: "quote" } });
    } catch {
      setStatus("error");
    }
  }

  if (!modalOpen && !thankYou) return null;

  return (
    <>
      {modalOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 p-4"
          onClick={closeModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Get a Quote"
            className="relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <h2 className="font-display text-lg font-bold">Get a Quote</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Tell us your requirement — we&apos;ll send a detailed quote within 24 hours.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border hover:bg-surface"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate data-analytics-form="quote">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-soft">
                      Your requirement
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <label className={labelCls}>What do you need? *</label>
                    <textarea
                      name="inquiry"
                      rows={3}
                      className={field}
                      placeholder="Describe the product, process, or challenge — material, application, tolerances…"
                    />
                    {errors.inquiry && <p className="mt-1 text-xs text-brand">{errors.inquiry}</p>}
                  </div>

                  <div>
                    <label className={labelCls}>Application / industry</label>
                    <input name="application" className={field} placeholder="e.g. Battery research, water treatment…" />
                  </div>

                  <div>
                    <label className={labelCls}>Material</label>
                    <input name="material" className={field} placeholder="e.g. Platinum, Alumina 99.7%…" />
                  </div>

                  <div>
                    <label className={labelCls}>Size / dimensions</label>
                    <div className="flex items-stretch overflow-hidden rounded-xl border border-input bg-surface transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-ring/30">
                      <input
                        name="sizeValue"
                        inputMode="decimal"
                        placeholder="Value — e.g. 50"
                        className="flex-1 bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
                      />
                      <select
                        name="sizeUnit"
                        defaultValue="mm"
                        aria-label="Unit"
                        className="shrink-0 border-l border-input bg-muted/40 px-3 text-sm font-medium outline-none"
                      >
                        <optgroup label="Length" style={{ fontWeight: 700 }}>
                          <option value="nm">nm</option>
                          <option value="µm">µm</option>
                          <option value="mm">mm</option>
                          <option value="cm">cm</option>
                          <option value="m">m</option>
                          <option value="in">inch</option>
                          <option value="ft">ft</option>
                        </optgroup>
                        <optgroup label="Volume" style={{ fontWeight: 700 }}>
                          <option value="µL">µL</option>
                          <option value="mL">mL</option>
                          <option value="L">L</option>
                          <option value="m³">m³</option>
                          <option value="gal">gal</option>
                        </optgroup>
                        <optgroup label="Area" style={{ fontWeight: 700 }}>
                          <option value="mm²">mm²</option>
                          <option value="cm²">cm²</option>
                          <option value="m²">m²</option>
                          <option value="in²">in²</option>
                        </optgroup>
                        <optgroup label="Weight" style={{ fontWeight: 700 }}>
                          <option value="mg">mg</option>
                          <option value="g">g</option>
                          <option value="kg">kg</option>
                          <option value="lb">lb</option>
                        </optgroup>
                        <optgroup label="Temperature" style={{ fontWeight: 700 }}>
                          <option value="°C">°C</option>
                          <option value="°F">°F</option>
                          <option value="K">K</option>
                        </optgroup>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Quantity</label>
                    <div className="flex w-full items-stretch overflow-hidden rounded-xl border border-input bg-surface focus-within:border-brand focus-within:ring-2 focus-within:ring-ring/30">
                      <button
                        type="button"
                        onClick={() => setQtyClamped(qty - 1)}
                        disabled={qty <= QTY_MIN}
                        aria-label="Decrease"
                        className="flex w-11 shrink-0 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        min={QTY_MIN}
                        max={QTY_MAX}
                        step={1}
                        value={qty}
                        onChange={(e) => setQtyClamped(Number(e.target.value))}
                        className="w-full border-x border-input bg-transparent py-2.5 text-center text-sm font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => setQtyClamped(qty + 1)}
                        disabled={qty >= QTY_MAX}
                        aria-label="Increase"
                        className="flex w-11 shrink-0 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">1 – 100,000</p>
                  </div>

                  <div className="sm:col-span-2">
                    <label className={labelCls}>Attach files (optional)</label>
                    <AttachmentUploader source="quote-modal" onChange={setAttachments} />
                  </div>

                  <div className="sm:col-span-2">
                    <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-brand-soft">
                      Contact details
                    </p>
                  </div>

                  <div>
                    <label className={labelCls}>Full name *</label>
                    <input name="name" className={field} placeholder="Your name" />
                    {errors.name && <p className="mt-1 text-xs text-brand">{errors.name}</p>}
                  </div>

                  <div>
                    <label className={labelCls}>Company (optional)</label>
                    <input name="company" className={field} placeholder="Company name" />
                  </div>

                  <div>
                    <label className={labelCls}>Mobile number *</label>
                    <input name="mobile" className={field} placeholder="+91 …" inputMode="tel" />
                    {errors.mobile && <p className="mt-1 text-xs text-brand">{errors.mobile}</p>}
                  </div>

                  <div>
                    <label className={labelCls}>Email *</label>
                    <input name="email" type="email" className={field} placeholder="you@company.com" />
                    {errors.email && <p className="mt-1 text-xs text-brand">{errors.email}</p>}
                  </div>

                  {status === "error" && (
                    <div className="sm:col-span-2">
                      <p className="text-sm text-brand">Something went wrong. Please try again.</p>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={status === "sending" || uploading}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
                >
                  {status === "sending" ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                  ) : uploading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Uploading files…</>
                  ) : (
                    <><Send className="h-4 w-4" /> Send quote request</>
                  )}
                </button>
                <p className="text-center text-xs text-muted-foreground">
                  We&apos;ll only use your details to respond to this request.
                </p>
              </form>
            </div>
          </div>
        </div>
      )}

      {thankYou && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4" onClick={() => setThankYou(false)}>
          <div className="w-full max-w-sm rounded-3xl border border-border bg-background p-8 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand/15 text-brand">
              <Check className="h-8 w-8" />
            </span>
            <h3 className="mt-5 font-display text-xl font-bold">Request sent!</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              We&apos;ve received your quote request and will get back to you within 24 hours.
            </p>
            {emailed && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs text-muted-foreground">
                <Mail className="h-3.5 w-3.5 text-brand" /> A copy has been sent to your email.
              </p>
            )}
            <button
              type="button"
              onClick={() => setThankYou(false)}
              className="mt-6 w-full rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
