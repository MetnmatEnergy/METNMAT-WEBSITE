"use client";

import * as React from "react";
import { fieldClass, Label } from "@/frontend/components/ui/field";
import { NERNST_SLOPE, REFERENCE_ELECTRODES, toOtherReference, toRhe, toShe } from "@/frontend/lib/potential-convert";

const volts = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(3)} V`;

export function PotentialConverter() {
  const [measured, setMeasured] = React.useState("1.000");
  const [refId, setRefId] = React.useState("hgo-koh");
  const [pH, setPH] = React.useState("14");
  const [otherId, setOtherId] = React.useState("agcl-sat");

  const ref = REFERENCE_ELECTRODES.find((r) => r.id === refId) ?? REFERENCE_ELECTRODES[0];
  const other = REFERENCE_ELECTRODES.find((r) => r.id === otherId) ?? REFERENCE_ELECTRODES[0];
  const e = Number(measured);
  const ph = Number(pH);
  const valid = measured.trim() !== "" && pH.trim() !== "" && Number.isFinite(e) && Number.isFinite(ph);

  return (
    <div className="rounded-2xl border border-border bg-surface/40 p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="pc-measured">Measured potential (V)</Label>
          <input id="pc-measured" inputMode="decimal" className={fieldClass} value={measured} onChange={(ev) => setMeasured(ev.target.value)} />
        </div>
        <div>
          <Label htmlFor="pc-ref">Measured against</Label>
          <select id="pc-ref" className={fieldClass} value={refId} onChange={(ev) => setRefId(ev.target.value)}>
            {REFERENCE_ELECTRODES.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="pc-ph">Electrolyte pH</Label>
          <input id="pc-ph" inputMode="decimal" className={fieldClass} value={pH} onChange={(ev) => setPH(ev.target.value)} />
        </div>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-3" aria-live="polite">
        <div className="rounded-xl border border-border bg-background p-4">
          <dt className="text-sm text-muted-foreground">vs RHE</dt>
          <dd className="mt-1 font-display text-2xl font-bold">{valid ? volts(toRhe(e, ref.vsShe, ph)) : "—"}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <dt className="text-sm text-muted-foreground">vs SHE</dt>
          <dd className="mt-1 font-display text-2xl font-bold">{valid ? volts(toShe(e, ref.vsShe)) : "—"}</dd>
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <dt className="text-sm text-muted-foreground">
            <label htmlFor="pc-other">vs </label>
            <select id="pc-other" className="bg-transparent text-sm text-foreground" value={otherId} onChange={(ev) => setOtherId(ev.target.value)}>
              {REFERENCE_ELECTRODES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </dt>
          <dd className="mt-1 font-display text-2xl font-bold">{valid ? volts(toOtherReference(e, ref.vsShe, other.vsShe)) : "—"}</dd>
        </div>
      </dl>

      <p className="mt-4 text-sm text-muted-foreground">
        {valid
          ? `E(RHE) = ${e.toFixed(3)} + ${ref.vsShe.toFixed(3)} + ${NERNST_SLOPE} × ${ph} = ${toRhe(e, ref.vsShe, ph).toFixed(3)} V`
          : "Enter a potential and a pH."}
      </p>
    </div>
  );
}
