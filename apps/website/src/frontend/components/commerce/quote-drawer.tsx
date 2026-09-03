"use client";

import { getTracker } from "@/frontend/lib/analytics/collector";
import * as React from "react";
import { X, Check, Send, Loader2, Mail, Minus, Plus } from "lucide-react";
import { useQuote } from "@/frontend/components/commerce/quote-provider";
import { useDialog } from "@/frontend/components/ui/use-dialog";
import { newRequestId } from "@/frontend/lib/request-id";
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
  const [reference, setReference] = React.useState<string | null>(null);
  const [errorText, setErrorText] = React.useState<string | null>(null);
  /**
   * One key per filled-in form, so a double click, a retry or a refresh is
   * recognised server-side as the SAME request rather than filing a second RFQ
   * and re-sending both emails. Regenerated once a submission succeeds.
   */
  const requestIdRef = React.useRef<string>("");
  if (!requestIdRef.current) requestIdRef.current = newRequestId();
  const [qty, setQty] = React.useState(1);
  const [attachments, setAttachments] = React.useState<UploadItem[]>([]);
  const formRef = React.useRef<HTMLFormElement>(null);
  const asideRef = React.useRef<HTMLDivElement>(null);

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

  // Focus in, tab trap, Escape, scroll lock, focus back to the trigger.
  //
  // Returning focus is not a nicety here. This drawer is always mounted and
  // merely translated off-screen, so without the hand-back focus stays inside a
  // panel the user cannot see: the next Tab continues from an invisible form and
  // a keyboard user has no way to tell where they are.
  useDialog({ open, onClose: closeQuote, containerRef: asideRef });

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
    if (Object.keys(errs).length) {
      /*
       * Send the visitor to the problem.
       *
       * The panel is a full-height scrolling form, and the submit button sits at
       * the bottom of it. Setting the error state alone wrote a red line into a
       * <p> that was, by then, scrolled off the top — so tapping Submit with an
       * empty requirement box did visibly NOTHING, and the natural next move was
       * to tap again. Focusing scrolls the field into the panel's own scroll
       * container for free and gives keyboard and screen-reader users the same
       * landing point.
       *
       * Ordered by DOM position, not validation order, so focus lands on the
       * topmost problem rather than whichever rule happened to run first. Same
       * pattern as app/checkout/page.tsx.
       */
      const first = ["design", "name", "mobile", "email"].find((k) => errs[k]);
      if (first) document.getElementById(`q-${first}`)?.focus();
      return;
    }

    // Only uploads that came back with a grant can be submitted — the API
    // refuses a bare id, so an ungranted upload would be dropped silently.
    const done = attachments.filter((a) => a.status === "done" && a.id && a.grant);
    const attachmentGrants = done.map((a) => a.grant as string);
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
    setErrorText(null);
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
          attachmentGrants,
          attachmentNames,
          requestId: requestIdRef.current,
          // Same hidden field every other public form on this site carries. Its
          // absence here made this the one form a bot could submit unimpeded.
          hp_company_url: get("hp_company_url"),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        reference?: string;
        emailedCustomer?: boolean;
        pending?: boolean;
      };
      if (!res.ok || data.ok === false) {
        // Show what the server actually said. Replacing a 429 or a "we couldn't
        // file your request" with a flat "Something went wrong" told the
        // customer nothing and invited an immediate retry that would fail too.
        setErrorText(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setReference(data.reference ?? null);
      setEmailed(Boolean(data.emailedCustomer));
      setStatus("idle");
      closeQuote();
      setThankYou(true);
      // A new key: the next submission is a genuinely different request.
      requestIdRef.current = newRequestId();
      getTracker().track("form_submit", { meta: { form: "quote" } });
    } catch {
      setErrorText("We couldn't reach the server. Please check your connection and try again.");
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
      {/* A plain <div>, not <aside>: <aside> already carries an implicit
          `complementary` role, and role="dialog" is not permitted to override
          it — axe flags this as aria-allowed-role on every page the drawer
          mounts on, which is all of them. */}
      <div
        ref={asideRef}
        tabIndex={-1}
        // Always mounted, so when closed its inputs and buttons would otherwise
        // stay tabbable and exposed to screen readers while sitting off-screen.
        // inert removes the whole subtree from the tab order and the a11y tree
        // without unmounting it, which keeps the slide transition intact.
        inert={!open}
        role="dialog"
        aria-modal="true"
        aria-label="Request for Customization"
        className={cn(
          "fixed right-0 top-0 z-[95] flex h-dvh w-full max-w-md flex-col rounded-l-3xl border-l-4 border-brand bg-background shadow-2xl outline-none transition-transform duration-300",
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

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate data-analytics-form="quote">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-soft">
              Your requirement
            </p>
            <div>
              <label htmlFor="q-design" className={labelCls}>Design / requirement *</label>
              <textarea
                id="q-design"
                aria-invalid={errors.design ? true : undefined}
                aria-describedby={errors.design ? "q-design-err" : undefined}
                name="design"
                rows={3}
                className={field}
                placeholder="Describe what you need — application, drawing, tolerances…"
              />
              {errors.design && <p id="q-design-err" role="alert" className="mt-1 text-xs text-brand">{errors.design}</p>}
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
                  // The two stepper buttons either side are labelled, but the
                  // field itself had no accessible name at all — a screen reader
                  // announced only "spin button".
                  aria-label="Quantity"
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
              <label htmlFor="q-name" className={labelCls}>Full name *</label>
              <input
                id="q-name"
                name="name"
                className={field}
                placeholder="Your name"
                autoComplete="name"
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? "q-name-err" : undefined}
              />
              {errors.name && <p id="q-name-err" role="alert" className="mt-1 text-xs text-brand">{errors.name}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="q-mobile" className={labelCls}>Mobile number *</label>
                <input
                  id="q-mobile"
                  name="mobile"
                  className={field}
                  placeholder="+91 …"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-invalid={errors.mobile ? true : undefined}
                  aria-describedby={errors.mobile ? "q-mobile-err" : undefined}
                />
                {errors.mobile && <p id="q-mobile-err" role="alert" className="mt-1 text-xs text-brand">{errors.mobile}</p>}
              </div>
              <div>
                <label htmlFor="q-email" className={labelCls}>Email *</label>
                <input
                  id="q-email"
                  name="email"
                  type="email"
                  className={field}
                  placeholder="you@company.com"
                  autoComplete="email"
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={errors.email ? "q-email-err" : undefined}
                />
                {errors.email && <p id="q-email-err" role="alert" className="mt-1 text-xs text-brand">{errors.email}</p>}
              </div>
            </div>
            <div>
              <label className={labelCls}>Company (optional)</label>
              <input name="company" className={field} placeholder="Company name" />
            </div>

            {/* Honeypot — never shown, never announced, never autofilled. A bot
                fills every input it finds; a person cannot reach this one. */}
            <input
              type="text"
              name="hp_company_url"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute left-[-9999px] h-px w-px opacity-0"
            />

            {status === "error" && (
              <p className="text-sm text-brand" role="alert">
                {errorText ?? "Something went wrong. Please try again."}
              </p>
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
      </div>

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
              Your request has been submitted successfully. Our team will get back to you soon.
            </p>
            {reference && (
              <p className="mt-4 rounded-xl border border-border bg-surface px-4 py-3">
                <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
                  Your reference
                </span>
                <span className="mt-0.5 block font-mono text-sm font-semibold">{reference}</span>
              </p>
            )}
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
