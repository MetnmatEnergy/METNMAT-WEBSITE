"use client";

import * as React from "react";
import { ArrowUpDown, Check, Copy, TriangleAlert } from "lucide-react";
import { fieldClass, Label } from "@/frontend/components/ui/field";
import { Select } from "@/frontend/components/ui/select";
import { PotentialRuler } from "@/frontend/components/tools/potential-ruler";
import {
  ELECTRODE_FAMILIES,
  ELECTROLYTE_PRESETS,
  REFERENCE_ELECTRODES,
  conversionTerms,
  convert,
  electrodeById,
  formatVsShe,
  parseNumber,
  phWarning,
  signed,
  volts,
  zeroVsShe,
  type ReferenceElectrode,
} from "@/frontend/lib/potential-convert";
import { cn } from "@/frontend/lib/utils";

/** The electrode picker: grouped by what it is made of, with each potential beside its filling. */
function ElectrodeSelect({
  id,
  value,
  onChange,
  hydrogenFirst = false,
}: {
  id: string;
  value: string;
  onChange: (id: string) => void;
  /** RHE and SHE are what people convert to, and rarely what they measure against. */
  hydrogenFirst?: boolean;
}) {
  const hydrogen = ELECTRODE_FAMILIES.filter((f) => f.id === "hydrogen");
  const metals = ELECTRODE_FAMILIES.filter((f) => f.id !== "hydrogen");
  const families = hydrogenFirst ? [...hydrogen, ...metals] : [...metals, ...hydrogen];
  const selected = electrodeById(value);
  const tile = ELECTRODE_FAMILIES.find((f) => f.id === selected.family)?.symbol;

  return (
    <Select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1.5 w-full rounded-lg border border-input bg-surface p-2 pr-3 outline-none transition-colors hover:border-foreground/30 focus:border-brand focus:ring-2 focus:ring-ring/30"
      renderValue={() => (
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background font-display text-sm font-bold">
            {tile}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{selected.label}</span>
            <span className="block truncate text-xs text-muted-foreground">{formatVsShe(selected)} vs SHE</span>
          </span>
        </span>
      )}
    >
      {families.map((family) => (
        <optgroup key={family.id} label={family.name} data-hint={family.hint} data-tile={family.symbol}>
          {REFERENCE_ELECTRODES.filter((r) => r.family === family.id).map((r) => (
            <option key={r.id} value={r.id} data-detail={formatVsShe(r)}>
              {r.fill}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}

export function PotentialConverter() {
  const [measured, setMeasured] = React.useState("0.600");
  const [fromId, setFromId] = React.useState("hgo-koh");
  const [toId, setToId] = React.useState("rhe");
  const [pH, setPH] = React.useState("14");
  const [copied, setCopied] = React.useState(false);

  const from = electrodeById(fromId);
  const to = electrodeById(toId);
  const e = parseNumber(measured);
  const ph = parseNumber(pH);
  const valid = Number.isFinite(e) && Number.isFinite(ph);
  const result = valid ? convert(e, from, to, ph) : 0;

  const scaleName = (r: ReferenceElectrode) => (r.followsPh ? `RHE at pH ${pH.trim()}` : r.label);
  const usesPh = from.followsPh || to.followsPh;
  // Hydrogen scales are arithmetic here. The electrode actually in the cell is the other one.
  const inCell = from.family === "hydrogen" ? to : from;
  const warning = !valid ? undefined : ph < 0 || ph > 14 ? "A pH outside 0 to 14 is unusual. Check the number." : phWarning(inCell, ph);
  const notes = [from, to].filter((r, i, all) => r.note && all.indexOf(r) === i);
  const rows = [...REFERENCE_ELECTRODES.filter((r) => r.family === "hydrogen"), ...REFERENCE_ELECTRODES.filter((r) => r.family !== "hydrogen")];

  React.useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(t);
  }, [copied]);

  const copy = () => {
    navigator.clipboard?.writeText(`${volts(result)} vs ${to.short}`).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  const swap = () => {
    setFromId(toId);
    setToId(fromId);
    if (valid) setMeasured(result.toFixed(3));
  };

  return (
    <div>
      <div className="grid overflow-hidden rounded-2xl border border-border lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-5 bg-surface/40 p-5 sm:p-6">
          <div>
            <Label htmlFor="pc-measured">Measured potential</Label>
            <div className="relative mt-1.5">
              <input
                id="pc-measured"
                inputMode="decimal"
                autoComplete="off"
                className={cn(fieldClass, "py-2 pr-20 font-display text-2xl font-semibold tabular-nums")}
                value={measured}
                onChange={(ev) => setMeasured(ev.target.value)}
              />
              <div className="absolute inset-y-0 right-2 flex items-center gap-1.5">
                {/* The decimal keypad on a phone has no minus key. */}
                <button
                  type="button"
                  aria-label="Change the sign"
                  onClick={() => setMeasured((m) => (/^\s*[-−]/.test(m) ? m.replace(/^\s*[-−]/, "") : `-${m.trim()}`))}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-base font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  ±
                </button>
                <span aria-hidden className="pr-1.5 text-sm font-medium text-muted-foreground">V</span>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="pc-from">Measured against</Label>
            <ElectrodeSelect id="pc-from" value={fromId} onChange={setFromId} />
          </div>

          <div>
            <Label
              htmlFor="pc-to"
              hint={
                <button
                  type="button"
                  onClick={swap}
                  className="inline-flex items-center gap-1 rounded font-medium text-brand-soft hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ArrowUpDown aria-hidden className="h-3.5 w-3.5" />
                  Swap
                </button>
              }
            >
              Convert to
            </Label>
            <ElectrodeSelect id="pc-to" value={toId} onChange={setToId} hydrogenFirst />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="pc-ph">Electrolyte pH</Label>
              <input
                id="pc-ph"
                inputMode="decimal"
                autoComplete="off"
                className={cn(fieldClass, "w-20 px-3 py-1.5 text-right font-medium tabular-nums")}
                value={pH}
                onChange={(ev) => setPH(ev.target.value)}
              />
            </div>
            <input
              type="range"
              min={0}
              max={14}
              step={0.1}
              aria-label="Electrolyte pH slider"
              value={Number.isFinite(ph) ? Math.min(14, Math.max(0, ph)) : 7}
              onChange={(ev) => setPH(ev.target.value)}
              className="mt-2 h-6 w-full cursor-pointer accent-brand"
            />
            <div className="mt-1 flex flex-wrap gap-1.5">
              {ELECTROLYTE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  aria-pressed={ph === p.pH}
                  onClick={() => setPH(String(p.pH))}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    ph === p.pH ? "border-brand bg-brand/10 font-medium text-brand-soft" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {!usesPh && <p className="mt-2 text-xs text-muted-foreground">Only RHE moves with pH, so this pair is not affected.</p>}
            {warning && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-brand-soft">
                <TriangleAlert aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
                {warning}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-between gap-6 bg-foreground p-5 text-background sm:p-7">
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 text-sm text-background/70">Your potential vs {to.followsPh ? scaleName(to) : to.short}</p>
              <button
                type="button"
                onClick={copy}
                disabled={!valid}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-background/25 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-background/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-background disabled:opacity-50"
              >
                {copied ? <Check aria-hidden className="h-3.5 w-3.5" /> : <Copy aria-hidden className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <output htmlFor="pc-measured pc-ph" aria-live="polite" className="mt-2 block font-display text-5xl font-bold sm:text-6xl">
              {valid ? (
                <>
                  {signed(result)}
                  <span className="ml-2 text-3xl font-semibold sm:text-4xl">V</span>
                </>
              ) : (
                "—"
              )}
            </output>
            {valid ? (
              <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                {conversionTerms(e, from, to, ph).map((t, i) => (
                  <span key={t.label} className="whitespace-nowrap">
                    <span className="font-medium tabular-nums">
                      {i === 0 ? signed(t.value).replace("+", "") : `${t.value < 0 ? "−" : "+"} ${Math.abs(t.value).toFixed(3)}`}
                    </span>{" "}
                    <span className="text-background/70">{t.label}</span>
                  </span>
                ))}
              </p>
            ) : (
              <p className="mt-3 text-sm text-background/70">Enter your potential in volts, and a pH.</p>
            )}
          </div>

          {valid && (
            <div>
              <PotentialRuler
                point={e + zeroVsShe(from, ph)}
                top={{ label: scaleName(from), zero: zeroVsShe(from, ph), reading: volts(e) }}
                bottom={{ label: scaleName(to), zero: zeroVsShe(to, ph), reading: volts(result) }}
              />
              <p className="mt-3 text-xs text-background/70">The red line is your potential. Each ruler counts it from its own zero.</p>
            </div>
          )}

          {notes.length > 0 && (
            <ul className="space-y-1 border-t border-background/20 pt-3 text-xs leading-relaxed text-background/70">
              {notes.map((r) => (
                <li key={r.id}>
                  <span className="font-medium text-background">{r.label}:</span> {r.note}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {valid && (
        <section aria-labelledby="pc-every-scale" className="mt-8">
          <h2 id="pc-every-scale" className="font-display text-xl font-bold tracking-tight sm:text-2xl">
            This potential on every scale
          </h2>
          <dl className="mt-3 grid gap-x-8 sm:grid-cols-2">
            {rows.map((r) => (
              <div key={r.id} className="flex items-baseline justify-between gap-4 border-b border-border py-2 text-sm">
                <dt className={cn("min-w-0", r.id === to.id ? "font-medium text-brand-soft" : "text-muted-foreground")}>
                  {r.followsPh ? scaleName(r) : r.label}
                  {r.id === from.id && " (your reading)"}
                </dt>
                <dd className={cn("shrink-0 tabular-nums", r.id === to.id ? "font-semibold text-brand-soft" : "font-medium text-foreground")}>
                  {volts(convert(e, from, r, ph))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
