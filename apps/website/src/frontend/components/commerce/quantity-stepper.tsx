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
      {/* 44px touch targets on mobile; compact 36px where a precise pointer exists. */}
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-11 w-11 items-center justify-center rounded-l-full transition-colors hover:bg-surface sm:h-9 sm:w-9"
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || min))}
        aria-label="Quantity"
        className="h-11 w-12 border-x border-border bg-transparent text-center text-sm tabular-nums outline-none [appearance:textfield] sm:h-9 [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(value + 1)}
        className="flex h-11 w-11 items-center justify-center rounded-r-full transition-colors hover:bg-surface sm:h-9 sm:w-9"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
