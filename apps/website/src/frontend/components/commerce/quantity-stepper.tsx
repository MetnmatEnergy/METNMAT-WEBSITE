"use client";

import { Minus, Plus } from "lucide-react";

export function QuantityStepper({
  value,
  min = 1,
  onChange,
}: {
  value: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-border">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-9 w-9 items-center justify-center rounded-l-full hover:bg-surface"
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="number"
        value={value}
        min={min}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || min))}
        className="h-9 w-12 border-x border-border bg-transparent text-center text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(value + 1)}
        className="flex h-9 w-9 items-center justify-center rounded-r-full hover:bg-surface"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
