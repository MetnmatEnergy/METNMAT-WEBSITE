"use client";

import * as React from "react";
import Link from "next/link";
import {
  LifeBuoy, Search, Loader2, CheckCircle2, Paperclip, X, Send,
  ShieldCheck, Clock, MessageSquare,
} from "lucide-react";
import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { cn } from "@/frontend/lib/utils";

const field =
  "w-full rounded-lg border border-input bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-ring/30";

const CATEGORIES = [
  { value: "order-issue", label: "Order issue" },
  { value: "product-quality", label: "Product quality / damage" },
  { value: "shipping-delivery", label: "Shipping & delivery" },
  { value: "payment-billing", label: "Payment & billing" },
  { value: "technical-support", label: "Technical support" },
  { value: "other", label: "Other" },
];

const STATUS_META: Record<string, { label: string; cls: string; step: number }> = {
  open: { label: "Open", cls: "bg-blue-500/10 text-blue-500", step: 0 },
  "in-progress": { label: "In progress", cls: "bg-amber-500/10 text-amber-500", step: 1 },
  waiting: { label: "Waiting on you", cls: "bg-amber-500/10 text-amber-500", step: 1 },
  resolved: { label: "Resolved", cls: "bg-emerald-500/10 text-emerald-500", step: 2 },
  closed: { label: "Closed", cls: "bg-muted text-muted-foreground", step: 2 },
};

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) : "";

type UploadedFile = { id: string; filename: string };
type TicketMessage = { from: "customer" | "staff"; authorName?: string; body: string; createdAt?: string };
type TicketView = {
  ticketNumber: string; status: string; subject: string; category?: string;
  orderNumber?: string; description: string; createdAt?: string; messages: TicketMessage[];
};

function Label({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-muted-foreground">
      {children}{required && <span className="text-brand"> *</span>}
    </label>
  );
}

export function SupportClient() {
  const [view, setView] = React.useState<"raise" | "status">("raise");
  const [prefillOrder, setPrefillOrder] = React.useState("");
  const [prefillTicket, setPrefillTicket] = React.useState("");

  // Read ?order= / ?view=status&ticket= on mount (client-only, avoids Suspense churn).
  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("order")) setPrefillOrder(q.get("order") || "");
    if (q.get("view") === "status") setView("status");
    if (q.get("ticket")) {
      setPrefillTicket(q.get("ticket") || "");
      setView("status");
    }
  }, []);

  return (
    <Container className="py-10 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <LifeBuoy className="h-7 w-7" />
          </span>
          <h1 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-4xl">How can we help?</h1>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Raise a ticket about an order, product or payment — and track it any time. We typically
            reply within one business day.
          </p>
        </div>

        {/* Tabs */}
        <div className="mt-8 flex rounded-full border border-border bg-surface p-1">
          {([["raise", "Raise a ticket"], ["status", "Check status"]] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn(
                "flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors",
                view === v ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {view === "raise" ? (
            <RaiseTicket defaultOrder={prefillOrder} onRaised={() => setView("status")} />
          ) : (
            <CheckStatus defaultTicket={prefillTicket} />
          )}
        </div>
      </div>
    </Container>
  );
}

// ── Raise a ticket ───────────────────────────────────────────────────────────

function RaiseTicket({ defaultOrder, onRaised }: { defaultOrder: string; onRaised: () => void }) {
  const [f, setF] = React.useState({
    name: "", email: "", phone: "", category: "order-issue",
    subject: "", description: "", orderNumber: defaultOrder,
  });
  React.useEffect(() => { if (defaultOrder) setF((s) => ({ ...s, orderNumber: defaultOrder })); }, [defaultOrder]);

  const [files, setFiles] = React.useState<UploadedFile[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!list.length) return;
    setUploading(true);
    setError(null);
    for (const file of list) {
      if (files.length >= 5) break;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("source", "support");
      try {
        const res = await fetch("/api/quote/upload", { method: "POST", body: fd });
        const d = await res.json();
        if (res.ok && d.id) setFiles((prev) => [...prev, { id: d.id, filename: d.filename || file.name }]);
        else setError(d.error || "Couldn't attach that file.");
      } catch {
        setError("Upload failed. Please retry.");
      }
    }
    setUploading(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!f.name.trim()) return setError("Please enter your name.");
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setError("Please enter a valid email.");
    if (f.subject.trim().length < 3) return setError("Please add a short subject.");
    if (f.description.trim().length < 10) return setError("Please describe your issue in a little more detail.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, attachmentIds: files.map((x) => x.id) }),
      });
      const d = await res.json();
      if (res.ok && d.ok) setDone(d.ticketNumber);
      else setError(d.error || "Could not create your ticket. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </span>
        <h2 className="mt-5 font-display text-2xl font-bold">Ticket created</h2>
        <p className="mt-2 text-muted-foreground">
          Your ticket number is{" "}
          <span className="rounded-lg bg-background px-2.5 py-1 font-display font-bold text-brand">{done}</span>
        </p>
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
          We&apos;ve emailed a confirmation to <strong>{f.email}</strong>. Keep your ticket number to
          track progress and reply.
        </p>
        <div className="mt-6 flex justify-center">
          <Button onClick={onRaised}>Track this ticket</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-surface p-6 sm:p-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="s-name" required>Your name</Label>
          <input id="s-name" className={field} autoComplete="name" value={f.name} onChange={set("name")} />
        </div>
        <div>
          <Label htmlFor="s-email" required>Email</Label>
          <input id="s-email" type="email" className={field} autoComplete="email" value={f.email} onChange={set("email")} />
        </div>
        <div>
          <Label htmlFor="s-phone">Phone (optional)</Label>
          <input id="s-phone" type="tel" className={field} autoComplete="tel" value={f.phone} onChange={set("phone")} />
        </div>
        <div>
          <Label htmlFor="s-order">Order number (optional)</Label>
          <input id="s-order" className={field} placeholder="e.g. MM-20260612-XXXX" value={f.orderNumber} onChange={set("orderNumber")} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="s-category" required>What is this about?</Label>
          <select id="s-category" className={field} value={f.category} onChange={set("category")}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="s-subject" required>Subject</Label>
          <input id="s-subject" className={field} placeholder="Briefly, what's the issue?" value={f.subject} onChange={set("subject")} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="s-desc" required>Describe your issue</Label>
          <textarea id="s-desc" rows={5} className={field} placeholder="Tell us what happened and what you'd like us to do." value={f.description} onChange={set("description")} />
        </div>
      </div>

      {/* Attachments */}
      <div className="mt-4">
        <Label htmlFor="s-files">Attachments (optional — photos, invoice, up to 5)</Label>
        <label className={cn("inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm hover:border-brand/50", files.length >= 5 && "pointer-events-none opacity-50")}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          {uploading ? "Uploading…" : "Add files"}
          <input id="s-files" type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={onFiles} disabled={files.length >= 5} />
        </label>
        {files.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {files.map((file, i) => (
              <li key={file.id} className="inline-flex items-center gap-2 rounded-full bg-background px-3 py-1 text-xs">
                <span className="max-w-[12rem] truncate">{file.filename}</span>
                <button type="button" aria-label={`Remove ${file.filename}`} onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-brand">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="mt-4 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 text-sm text-brand" role="alert">{error}</p>}

      <Button type="submit" disabled={submitting || uploading} className="mt-5 w-full" size="lg">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LifeBuoy className="h-4 w-4" />}
        {submitting ? "Creating ticket…" : "Submit ticket"}
      </Button>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-brand" /> We&apos;ll email a confirmation with your ticket number.
      </p>
    </form>
  );
}

// ── Check status ─────────────────────────────────────────────────────────────

function CheckStatus({ defaultTicket }: { defaultTicket: string }) {
  const [ticketNo, setTicketNo] = React.useState(defaultTicket);
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ticket, setTicket] = React.useState<TicketView | null>(null);
  React.useEffect(() => { if (defaultTicket) setTicketNo(defaultTicket); }, [defaultTicket]);

  async function lookup(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!ticketNo.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      return setError("Enter your ticket number and the email you used.");
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/support/status?ticket=${encodeURIComponent(ticketNo.trim())}&email=${encodeURIComponent(email.trim())}`);
      const d = await res.json();
      if (res.ok && d.ok) setTicket(d.ticket);
      else { setTicket(null); setError(d.error || "No ticket found."); }
    } catch {
      setError("Couldn't reach support. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={lookup} className="rounded-2xl border border-border bg-surface p-6 sm:p-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="c-ticket" required>Ticket number</Label>
            <input id="c-ticket" className={field} placeholder="TKT-XXXXXXXX-XXXX" value={ticketNo} onChange={(e) => setTicketNo(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="c-email" required>Email on the ticket</Label>
            <input id="c-email" type="email" className={field} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        {error && <p className="mt-4 rounded-lg border border-brand/40 bg-brand/10 px-3 py-2 text-sm text-brand" role="alert">{error}</p>}
        <Button type="submit" disabled={loading} className="mt-5 w-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? "Looking up…" : "View ticket"}
        </Button>
      </form>

      {ticket && <TicketDetail ticket={ticket} email={email} onUpdate={() => lookup()} />}
    </div>
  );
}

function StatusStepper({ status }: { status: string }) {
  const step = STATUS_META[status]?.step ?? 0;
  const steps = ["Received", "In progress", "Resolved"];
  return (
    <div className="mt-4 flex items-center">
      {steps.map((label, i) => (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center">
            <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold", i <= step ? "bg-brand text-brand-foreground" : "border border-border bg-surface text-muted-foreground")}>
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </span>
            <span className={cn("mt-1.5 text-[11px]", i <= step ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span>
          </div>
          {i < steps.length - 1 && <span className={cn("mx-1 h-0.5 flex-1 rounded", i < step ? "bg-brand" : "bg-border")} />}
        </React.Fragment>
      ))}
    </div>
  );
}

function TicketDetail({ ticket, email, onUpdate }: { ticket: TicketView; email: string; onUpdate: () => void }) {
  const meta = STATUS_META[ticket.status] ?? STATUS_META.open;
  const [reply, setReply] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [replyErr, setReplyErr] = React.useState<string | null>(null);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    setReplyErr(null);
    if (reply.trim().length < 2) return;
    setSending(true);
    try {
      const res = await fetch("/api/support/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: ticket.ticketNumber, email, body: reply.trim() }),
      });
      const d = await res.json();
      if (res.ok && d.ok) { setReply(""); onUpdate(); }
      else setReplyErr(d.error || "Could not send. Try again.");
    } catch {
      setReplyErr("Could not send. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-5 rounded-2xl border border-border bg-surface p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-bold">{ticket.ticketNumber}</span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", meta.cls)}>{meta.label}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{ticket.subject}</p>
          {ticket.orderNumber && <p className="mt-0.5 text-xs text-muted-foreground">Order: {ticket.orderNumber}</p>}
        </div>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> Opened {fmtDate(ticket.createdAt)}
        </span>
      </div>

      <StatusStepper status={ticket.status} />

      {/* Conversation */}
      <div className="mt-6">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" /> Conversation
        </p>
        <div className="mt-3 space-y-3">
          <Bubble from="customer" authorName={ticket.subject ? "You" : "You"} body={ticket.description} createdAt={ticket.createdAt} youLabel />
          {ticket.messages.map((m, i) => (
            <Bubble key={i} from={m.from} authorName={m.authorName} body={m.body} createdAt={m.createdAt} youLabel={m.from === "customer"} />
          ))}
        </div>
      </div>

      {/* Reply */}
      {ticket.status !== "closed" ? (
        <form onSubmit={sendReply} className="mt-5 border-t border-border pt-5">
          <Label htmlFor="r-body">Add a reply</Label>
          <textarea id="r-body" rows={3} className={field} placeholder="Type your message…" value={reply} onChange={(e) => setReply(e.target.value)} />
          {replyErr && <p className="mt-2 text-xs text-brand" role="alert">{replyErr}</p>}
          <div className="mt-3 flex justify-end">
            <Button type="submit" size="sm" disabled={sending || reply.trim().length < 2}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send reply
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-5 border-t border-border pt-5 text-center text-sm text-muted-foreground">
          This ticket is closed.{" "}
          <Link href="/support" className="text-brand underline underline-offset-2">Raise a new ticket</Link> if you still need help.
        </p>
      )}
    </div>
  );
}

function Bubble({ from, authorName, body, createdAt, youLabel }: { from: "customer" | "staff"; authorName?: string; body: string; createdAt?: string; youLabel?: boolean }) {
  const isYou = from === "customer";
  return (
    <div className={cn("flex", isYou ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5", isYou ? "bg-brand text-brand-foreground" : "border border-border bg-background")}>
        <div className={cn("mb-0.5 text-[11px] font-semibold", isYou ? "text-brand-foreground/80" : "text-brand-soft")}>
          {isYou ? (youLabel ? "You" : authorName || "You") : authorName || "METNMAT Support"}
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
        {createdAt && <div className={cn("mt-1 text-[10px]", isYou ? "text-brand-foreground/70" : "text-muted-foreground")}>{fmtDate(createdAt)}</div>}
      </div>
    </div>
  );
}
