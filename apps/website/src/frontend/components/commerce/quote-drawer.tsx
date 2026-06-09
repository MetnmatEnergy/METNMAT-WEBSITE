"use client";

import * as React from "react";
import { X, Check, Send, Loader2, Mail, Minus, Plus } from "lucide-react";
import { useQuote } from "@/frontend/components/commerce/quote-provider";
import {
  AttachmentUploader,
  type UploadItem,
} from "@/frontend/components/commerce/attachment-uploader";
import { cn } from "@/frontend/lib/utils";

const field =
  "w-full rounded-xl border border-input bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-ring/30";
const labelCls = "mb-1.5 block text-sm font-medium";

const QTY_MIN = 1;
const QTY_MAX = 100000;

export function QuoteDrawer() {
  const { open, product, closeQuote } = useQuote();
  const [status, setStatus] = React.useState<"idle" | "sending" | "error">("idle");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [thankYou, setThankYou] = React.useState(false);
  const [emailed, setEmailed] = React.useState(false);
  const [qty, setQty] = React.useState(1);
  const [attachments, setAttachments] = React.useState<UploadItem[]>([]);
  const formRef = React.useRef<HTMLFormElement>(null);

  const uploading = attachments.some((a) => a.status === "uploading");

  React.useEffect(() => {
    if (open) {
      setStatus("idle");
      setErrors({});
      setQty(1);
      setAttachments([]);
      formRef.current?.reset();
    }
  }, [open, product]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeQuote();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, closeQuote]);

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
    const design = get("design");
    const sizeValue = get("sizeValue");
    const sizeUnit = get("sizeUnit");
    const customSize = sizeValue ? `${sizeValue} ${sizeUnit}` : "";
    // A size selected from the product page takes precedence; custom dims append.
    const size = [product?.size, customSize].filter(Boolean).join(" · ");
    const quantity = String(qty);

    const errs: Record<string, string> = {};
    if (name.length < 2) errs.name = "Please enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email.";
    if (mobile.replace(/\D/g, "").length < 10) errs.mobile = "Enter a valid mobile number.";
    if (design.length < 3) errs.design = "Describe your requirement.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const done = attachments.filter((a) => a.status === "done" && a.id);
    const attachmentIds = done.map((a) => a.id as string);
    const attachmentNames = done.map((a) => a.name);

    const message = [
      product
        ? `Product: ${product.name}${product.sku ? ` (Code: ${product.sku})` : ""} [${product.slug}]`
        : "General customization enquiry",
      `Design / requirement: ${design}`,
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
          design,
          size,
          material: get("material"),
          quantity,
          product: product ? { name: product.name, sku: product.sku, slug: product.slug } : null,
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
      closeQuote();
      setThankYou(true);
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[90] bg-black/60 transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={closeQuote}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Request for Customization"
        className={cn(
          "fixed right-0 top-0 z-[95] flex h-dvh w-full max-w-md flex-col rounded-l-3xl border-l-4 border-brand bg-background shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <div>
            <h2 className="font-display text-lg font-bold">Request for Customization</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Tell us your design, size &amp; material — we&apos;ll get back to you.
            </p>
          </div>
          <button
            type="button"
            onClick={closeQuote}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border hover:bg-surface"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {product && (
            <div className="mb-5 rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
              <span className="text-muted-foreground">Customizing </span>
              <span className="font-medium">{product.name}</span>
              {product.sku && (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Product code: <span className="font-medium text-foreground">{product.sku}</span>
                </span>
              )}
              {product.size && (
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand-soft">
                  Selected size: {product.size}
                </span>
              )}
            </div>
          )}

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-soft">
              Your requirement
            </p>
            <div>
              <label className={labelCls}>Design / requirement *</label>
              <textarea
                name="design"
                rows={3}
                className={field}
                placeholder="Describe what you need — application, drawing, tolerances…"
              />
              {errors.design && <p className="mt-1 text-xs text-brand">{errors.design}</p>}
            </div>
            <div>
              <label className={labelCls}>Size / dimensions</label>
              <div className="flex items-stretch overflow-hidden rounded-xl border border-input bg-surface transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-ring/30">
                <input
                  name="sizeValue"
                  inputMode="decimal"
                  placeholder="Enter value — e.g. 50 or 6×70"
                  className="flex-1 bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
                />
                <select
                  name="sizeUnit"
                  defaultValue="mm"
                  aria-label="Unit"
                  className="shrink-0 border-l border-input bg-muted/40 px-3 text-sm font-medium outline-none"
                >
                  <optgroup label="Length" style={{ fontWeight: 700 }}>
                    <option value="nm">nm (nanometre)</option>
                    <option value="µm">µm (micron)</option>
                    <option value="mm">mm</option>
                    <option value="cm">cm</option>
                    <option value="m">m</option>
                    <option value="in">inch</option>
                    <option value="ft">ft (feet)</option>
                  </optgroup>
                  <optgroup label="Volume" style={{ fontWeight: 700 }}>
                    <option value="µL">µL</option>
                    <option value="mL">mL</option>
                    <option value="cL">cL</option>
                    <option value="L">L</option>
                    <option value="m³">m³</option>
                    <option value="gal">gal (US)</option>
                    <option value="fl oz">fl oz</option>
                  </optgroup>
                  <optgroup label="Area" style={{ fontWeight: 700 }}>
                    <option value="mm²">mm²</option>
                    <option value="cm²">cm²</option>
                    <option value="m²">m²</option>
                    <option value="in²">in²</option>
                    <option value="ft²">ft²</option>
                  </optgroup>
                  <optgroup label="Weight" style={{ fontWeight: 700 }}>
                    <option value="mg">mg</option>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
                    <option value="oz">oz</option>
                    <option value="lb">lb</option>
                  </optgroup>
                  <optgroup label="Temperature" style={{ fontWeight: 700 }}>
                    <option value="°C">°C</option>
                    <option value="°F">°F</option>
                    <option value="K">K</option>
                  </optgroup>
                </select>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Type the measurement and choose its unit — e.g. 6×70 mm or 50 mL.
              </p>
            </div>

            <div>
              <label className={labelCls}>Material</label>
              <input name="material" className={field} placeholder="e.g. Alumina 99.7%" />
            </div>

            <div>
              <label className={labelCls}>Quantity</label>
              <div className="flex w-full max-w-[220px] items-stretch overflow-hidden rounded-xl border border-input bg-surface focus-within:border-brand focus-within:ring-2 focus-within:ring-ring/30">
                <button
                  type="button"
                  onClick={() => setQtyClamped(qty - 1)}
                  disabled={qty <= QTY_MIN}
                  aria-label="Decrease quantity"
                  className="flex w-11 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  name="quantity"
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
                  aria-label="Increase quantity"
                  className="flex w-11 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Use − / + or type a number (1–100,000).
              </p>
            </div>

            <div>
              <label className={labelCls}>Attach files (optional)</label>
              <AttachmentUploader source="quote-drawer" onChange={setAttachments} />
            </div>

            <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-brand-soft">
              Contact details
            </p>
            <div>
              <label className={labelCls}>Full name *</label>
              <input name="name" className={field} placeholder="Your name" />
              {errors.name && <p className="mt-1 text-xs text-brand">{errors.name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            <div>
              <label className={labelCls}>Company (optional)</label>
              <input name="company" className={field} placeholder="Company name" />
            </div>

            {status === "error" && (
              <p className="text-sm text-brand">Something went wrong. Please try again.</p>
            )}

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
                <><Send className="h-4 w-4" /> Submit request</>
              )}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              We&apos;ll only use your details to respond to this request.
            </p>
          </form>
        </div>
      </aside>

      {thankYou && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4"
          onClick={() => setThankYou(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-border bg-background p-8 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand/15 text-brand">
              <Check className="h-8 w-8" />
            </span>
            <h3 className="mt-5 font-display text-xl font-bold">Thank you!</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              We&apos;ve received your customization request and will get back to you soon.
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
