"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/frontend/lib/utils";

/**
 * Shared form primitives for account/auth screens. Single source of truth for the
 * input styling that used to be a duplicated `field` string across login,
 * profile, and password forms. Theme-token driven (auto light/dark).
 */
export const fieldClass =
  "w-full rounded-lg border border-input bg-surface px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60";

export function Label({
  htmlFor,
  children,
  hint,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <span className="flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground/90">
        {children}
      </label>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </span>
  );
}

export function FieldError({ id, children }: { id?: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-xs text-brand">
      {children}
    </p>
  );
}

type TextFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: React.ReactNode;
  labelHint?: React.ReactNode;
  error?: string;
  hint?: React.ReactNode;
  /** Element rendered inside the input on the right (e.g. a show/hide button). */
  rightSlot?: React.ReactNode;
};

/** Labelled input with optional hint, inline error, and a right-side slot. */
export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, labelHint, error, hint, rightSlot, className, id, ...props },
  ref,
) {
  const autoId = React.useId();
  const inputId = id || autoId;
  const errId = error ? `${inputId}-err` : undefined;
  return (
    <div className="grid gap-1.5">
      {label ? (
        <Label htmlFor={inputId} hint={labelHint}>
          {label}
        </Label>
      ) : null}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          className={cn(fieldClass, error && "border-brand focus:border-brand", rightSlot && "pr-11", className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={errId}
          {...props}
        />
        {rightSlot ? (
          <div className="absolute inset-y-0 right-1 flex items-center">{rightSlot}</div>
        ) : null}
      </div>
      {error ? <FieldError id={errId}>{error}</FieldError> : hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
});

type PasswordFieldProps = Omit<TextFieldProps, "type" | "rightSlot"> & { toggleLabel?: string };

/** Password input with a built-in show/hide toggle. */
export const PasswordField = React.forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { toggleLabel = "password", ...props },
  ref,
) {
  const [show, setShow] = React.useState(false);
  return (
    <TextField
      ref={ref}
      type={show ? "text" : "password"}
      rightSlot={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={`${show ? "Hide" : "Show"} ${toggleLabel}`}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
      {...props}
    />
  );
});

type SelectFieldProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: React.ReactNode;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
};

/** Labelled native select, styled to match TextField. */
export const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, hint, className, id, children, ...props },
  ref,
) {
  const autoId = React.useId();
  const selectId = id || autoId;
  return (
    <div className="grid gap-1.5">
      {label ? <Label htmlFor={selectId}>{label}</Label> : null}
      <select
        ref={ref}
        id={selectId}
        className={cn(fieldClass, "cursor-pointer appearance-none bg-[right_0.75rem_center] pr-9", className)}
        {...props}
      >
        {children}
      </select>
      {error ? <FieldError>{error}</FieldError> : hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
});
