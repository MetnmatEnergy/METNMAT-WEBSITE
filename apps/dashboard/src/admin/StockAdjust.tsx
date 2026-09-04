"use client";

import React from "react";
import { useDocumentInfo, useFormFields } from "@payloadcms/ui";

/**
 * Stock adjustment panel on the Product edit view.
 *
 * WHY THIS EXISTS. `stock-ledger` is an append-only record of every stock
 * movement, and until recently nothing wrote to it. The service now does, and
 * the order lifecycle now moves stock — but a staff member changing inventory by
 * hand still had only one option: type a new number into the `stockQty` field.
 * That wrote no ledger row, recorded no reason and no author, and could silently
 * overwrite a change someone else had just made.
 *
 * This is the authorized path. Every adjustment made here goes through the same
 * server-side service the order hooks use, so it is atomic, refuses to create an
 * impossible position, and leaves a row naming who did it and why.
 *
 * Deliberately plain: no observers, no timers, no animation. This project has a
 * production freeze in its history caused by a self-feeding MutationObserver,
 * and an admin form has no business adding anything of the kind.
 */

type Result = {
  previous: { stockQty: number; reservedStock: number };
  next: { stockQty: number; reservedStock: number };
  available: number;
};

const MOVEMENTS: { value: string; label: string; hint: string }[] = [
  { value: "stock-in", label: "Stock in", hint: "Goods received." },
  { value: "stock-out", label: "Stock out", hint: "Goods dispatched outside an order." },
  { value: "damaged", label: "Damaged", hint: "Written off — removed from sellable stock." },
  { value: "returned", label: "Returned", hint: "Came back and is sellable again." },
  { value: "reserved", label: "Reserve", hint: "Hold stock without dispatching it." },
  { value: "released", label: "Release", hint: "Give a hold back to available stock." },
];

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function StockAdjust() {
  const { id } = useDocumentInfo();

  // Read the current position straight from the form, so the panel agrees with
  // what the editor is looking at.
  const stockQty = useFormFields(([fields]) => num(fields?.stockQty?.value));
  const reservedStock = useFormFields(([fields]) => num(fields?.reservedStock?.value));
  const dispatchFields = useFormFields(([, dispatch]) => dispatch);

  const [mode, setMode] = React.useState<"movement" | "recount">("movement");
  const [movementType, setMovementType] = React.useState("stock-in");
  const [quantity, setQuantity] = React.useState("");
  const [countedQty, setCountedQty] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<Result | null>(null);

  if (!id) {
    return (
      <p style={hintStyle}>
        Save the product first — stock movements are recorded against a saved product.
      </p>
    );
  }

  const available = Math.max(0, stockQty - reservedStock);
  const selected = MOVEMENTS.find((m) => m.value === movementType);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const payload: Record<string, unknown> =
        mode === "recount"
          ? { id, countedQty: Number(countedQty), reason }
          : { id, movementType, quantity: Number(quantity), reason };

      const res = await fetch("/api/products/stock-movement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const j = (await res.json().catch(() => ({}))) as Partial<Result> & { ok?: boolean; error?: string };

      if (!res.ok || !j.ok || !j.next) {
        // Show what the server actually said — "only 3 in stock" is far more
        // use than "something went wrong".
        setError(j.error || "Stock movement failed.");
        return;
      }

      // Keep the form in step with the database without a page reload, so any
      // other unsaved edits on this document survive.
      dispatchFields?.({ type: "UPDATE", path: "stockQty", value: j.next.stockQty });
      dispatchFields?.({ type: "UPDATE", path: "reservedStock", value: j.next.reservedStock });

      setDone(j as Result);
      setQuantity("");
      setCountedQty("");
      setReason("");
    } catch {
      setError("Network error — the movement was not recorded.");
    } finally {
      setBusy(false);
    }
  };

  const canSubmit =
    !busy &&
    (mode === "recount"
      ? countedQty.trim() !== "" && Number(countedQty) >= 0
      : quantity.trim() !== "" && Number(quantity) > 0);

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 14 }}>
        <Figure label="On hand" value={stockQty} />
        <Figure label="Reserved" value={reservedStock} />
        <Figure label="Available" value={available} strong />
      </div>

      <div role="group" aria-label="Adjustment type" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Tab active={mode === "movement"} onClick={() => setMode("movement")}>
          Record a movement
        </Tab>
        <Tab active={mode === "recount"} onClick={() => setMode("recount")}>
          Recount
        </Tab>
      </div>

      {mode === "movement" ? (
        <div style={rowStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Movement</span>
            <select
              value={movementType}
              onChange={(e) => setMovementType(e.target.value)}
              style={inputStyle}
              disabled={busy}
            >
              {MOVEMENTS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label style={fieldStyle}>
            <span style={labelStyle}>Quantity</span>
            <input
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              style={inputStyle}
              disabled={busy}
              placeholder="0"
            />
          </label>
        </div>
      ) : (
        <div style={rowStyle}>
          <label style={fieldStyle}>
            <span style={labelStyle}>Counted quantity</span>
            <input
              type="number"
              min={0}
              step={1}
              value={countedQty}
              onChange={(e) => setCountedQty(e.target.value)}
              style={inputStyle}
              disabled={busy}
              placeholder={String(stockQty)}
            />
          </label>
          <p style={{ ...hintStyle, flex: 1, alignSelf: "flex-end", margin: 0 }}>
            Sets stock to what you actually counted. The ledger records the size of the correction.
          </p>
        </div>
      )}

      <label style={{ ...fieldStyle, marginTop: 10 }}>
        <span style={labelStyle}>Reason</span>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={inputStyle}
          disabled={busy}
          placeholder={mode === "recount" ? "Quarterly count" : "Delivery note 4417"}
          maxLength={200}
        />
      </label>

      {mode === "movement" && selected ? <p style={hintStyle}>{selected.hint}</p> : null}

      <button type="button" onClick={submit} disabled={!canSubmit} style={buttonStyle(!canSubmit)}>
        {busy ? "Recording…" : mode === "recount" ? "Record recount" : "Record movement"}
      </button>

      {error ? (
        <p role="alert" style={{ color: "#d81f26", fontSize: 12, marginTop: 8 }}>
          {error}
        </p>
      ) : null}

      {done ? (
        <p role="status" style={{ color: "var(--theme-success-500, #17803d)", fontSize: 12, marginTop: 8 }}>
          Recorded. On hand {done.previous.stockQty} → {done.next.stockQty}, available {done.available}.
        </p>
      ) : null}

      <p style={{ ...hintStyle, marginTop: 10 }}>
        Applies immediately and is written to the Stock Ledger with your name against it. It does not
        need the Save button, and it will not overwrite anyone else&rsquo;s change.
      </p>
    </div>
  );
}

function Figure({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em", opacity: 0.6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: strong ? 700 : 500, lineHeight: 1.2 }}>{value}</div>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: "5px 12px",
        borderRadius: 4,
        border: "1px solid var(--theme-elevation-150)",
        background: active ? "var(--theme-elevation-100)" : "transparent",
        color: "var(--theme-text)",
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        fontSize: 13,
      }}
    >
      {children}
    </button>
  );
}

const panelStyle: React.CSSProperties = {
  border: "1px solid var(--theme-elevation-150)",
  borderRadius: 6,
  padding: 16,
  marginBottom: 20,
  background: "var(--theme-elevation-50)",
};
const rowStyle: React.CSSProperties = { display: "flex", gap: 12, flexWrap: "wrap" };
const fieldStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, minWidth: 180, flex: 1 };
const labelStyle: React.CSSProperties = { fontSize: 12, opacity: 0.75 };
const inputStyle: React.CSSProperties = {
  padding: "7px 9px",
  borderRadius: 4,
  border: "1px solid var(--theme-elevation-150)",
  background: "var(--theme-input-bg, var(--theme-elevation-0))",
  color: "var(--theme-text)",
  fontSize: 14,
};
const hintStyle: React.CSSProperties = { fontSize: 12, opacity: 0.65, marginTop: 6 };

const buttonStyle = (disabled: boolean): React.CSSProperties => ({
  marginTop: 12,
  padding: "8px 14px",
  borderRadius: 4,
  border: "none",
  background: disabled ? "var(--theme-elevation-150)" : "#d81f26",
  color: disabled ? "var(--theme-text)" : "#fff",
  fontWeight: 600,
  fontSize: 13,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.7 : 1,
});
