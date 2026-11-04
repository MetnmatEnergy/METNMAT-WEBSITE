"use client";

import * as React from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { readOptions, type SelectOption } from "@/frontend/lib/select-options";
import { cn } from "@/frontend/lib/utils";

type NativeProps = Pick<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  | "id"
  | "name"
  | "value"
  | "defaultValue"
  | "onChange"
  | "required"
  | "disabled"
  | "className"
  | "children"
  | "autoComplete"
  | "form"
  | "aria-label"
  | "aria-labelledby"
  | "aria-invalid"
  | "aria-describedby"
  | "aria-busy"
>;

export type SelectProps = NativeProps & {
  /** A richer closed state. Receives the chosen option, or undefined for the placeholder. */
  renderValue?: (option: SelectOption | undefined) => React.ReactNode;
};

const PANEL_MAX_HEIGHT = 352;
const VIEWPORT_EDGE = 12;
const GAP = 6;

/**
 * The site's dropdown, in place of the browser's own list.
 *
 * A real <select> stays in the DOM, visually hidden, and holds the value. So
 * FormData, form.reset(), browser autofill, the option text in the served HTML
 * and every existing onChange handler keep working: choosing here sets that
 * select and fires a genuine change event on it.
 *
 * The list opens in the browser's top layer (popover="manual") rather than a
 * portal. It stays inside the form in the DOM, so a surrounding dialog still
 * counts it as inside, and nothing can clip it: not the quote modal's scroll
 * area, not the overflow-hidden size field, not a z-index. Focus stays on the
 * button throughout (aria-activedescendant), which leaves focus traps alone.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    id,
    name,
    value,
    defaultValue,
    onChange,
    required,
    disabled,
    className,
    children,
    autoComplete,
    form,
    renderValue,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
    "aria-busy": ariaBusy,
  },
  ref,
) {
  const uid = React.useId();
  const listId = `${uid}-list`;
  const optionId = (i: number) => `${uid}-option-${i}`;

  const { groups, placeholder } = readOptions(children);
  const flat = groups.flatMap((g) => g.options);
  const firstEnabled = flat.findIndex((o) => !o.disabled);

  const [own, setOwn] = React.useState(() => String(defaultValue ?? (placeholder === undefined ? flat[firstEnabled]?.value ?? "" : "")));
  const current = value !== undefined ? String(value) : own;
  const selected = flat.find((o) => o.value === current);

  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const nativeRef = React.useRef<HTMLSelectElement>(null);
  const typed = React.useRef({ text: "", at: 0 });
  const hovering = React.useRef(false);
  React.useImperativeHandle(ref, () => nativeRef.current as HTMLSelectElement);

  const show = (at?: number) => {
    if (disabled) return;
    const selectedAt = flat.findIndex((o) => o.value === current);
    hovering.current = false;
    setActive(at ?? (selectedAt >= 0 ? selectedAt : firstEnabled));
    setOpen(true);
    // Safari does not focus a button on click, and the keys are handled there.
    triggerRef.current?.focus();
  };

  const choose = (next: string) => {
    setOpen(false);
    const native = nativeRef.current;
    if (!native || native.value === next) return;
    native.value = next;
    native.dispatchEvent(new Event("change", { bubbles: true }));
  };

  /** The next enabled row in a direction, or the row we started on. */
  const step = (from: number, by: 1 | -1) => {
    for (let i = from + by; i >= 0 && i < flat.length; i += by) if (!flat[i].disabled) return i;
    return from;
  };

  /** Type-to-find, as a native select does. Repeating one letter cycles its matches. */
  const find = (key: string) => {
    const now = Date.now();
    const text = now - typed.current.at > 600 ? key : typed.current.text + key;
    typed.current = { text, at: now };
    const query = text.toLowerCase();
    const start = text.length === 1 ? active + 1 : Math.max(active, 0);
    for (let n = 0; n < flat.length; n++) {
      const i = (start + n) % flat.length;
      if (!flat[i].disabled && flat[i].label.toLowerCase().startsWith(query)) return i;
    }
    return -1;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    const typing = Date.now() - typed.current.at <= 600;

    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        show();
      } else if (printable) {
        const match = find(e.key);
        if (match >= 0) show(match);
      }
      return;
    }

    hovering.current = false;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(step(active, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(step(active, -1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(firstEnabled);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(step(flat.length, -1));
    } else if (e.key === "Enter" || (e.key === " " && !typing)) {
      e.preventDefault();
      if (flat[active] && !flat[active].disabled) choose(flat[active].value);
    } else if (e.key === "Tab") {
      if (flat[active] && !flat[active].disabled) choose(flat[active].value);
    } else if (printable) {
      e.preventDefault();
      const match = find(e.key);
      if (match >= 0) setActive(match);
    }
  };

  // Open into the top layer, on whichever side has room, and follow the button.
  React.useLayoutEffect(() => {
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    if (!open || !panel || !trigger) return;
    panel.showPopover?.();

    const place = (e?: Event) => {
      if (e?.target === panel) return;
      const box = trigger.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const below = window.innerHeight - box.bottom - GAP - VIEWPORT_EDGE;
      const above = box.top - GAP - VIEWPORT_EDGE;
      const up = below < Math.min(panel.scrollHeight, PANEL_MAX_HEIGHT) && above > below;
      panel.style.minWidth = `${Math.min(box.width, viewportWidth - VIEWPORT_EDGE * 2)}px`;
      panel.style.maxHeight = `${Math.max(Math.min(PANEL_MAX_HEIGHT, up ? above : below), 120)}px`;
      panel.style.left = `${Math.max(VIEWPORT_EDGE, Math.min(box.left, viewportWidth - panel.offsetWidth - VIEWPORT_EDGE))}px`;
      panel.style.top = up ? "auto" : `${box.bottom + GAP}px`;
      panel.style.bottom = up ? `${window.innerHeight - box.top + GAP}px` : "auto";
      panel.dataset.side = up ? "top" : "bottom";
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // Outside press closes it, in the capture phase and without preventDefault, so
  // the press still lands on whatever was under it. Escape is caught on window,
  // ahead of the document listener a dialog uses, so it closes this list only.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onEscape, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onEscape, true);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open || active < 0 || hovering.current) return;
    panelRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  // form.reset() rewinds the hidden select; bring the button along with it.
  React.useEffect(() => {
    const owner = nativeRef.current?.form;
    if (!owner) return;
    const onReset = () => window.setTimeout(() => setOwn(nativeRef.current?.value ?? ""), 0);
    owner.addEventListener("reset", onReset);
    return () => owner.removeEventListener("reset", onReset);
  }, []);

  let row = -1;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        aria-required={required || undefined}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-busy={ariaBusy}
        data-state={open ? "open" : "closed"}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        onKeyUp={(e) => e.key === " " && e.preventDefault()}
        onBlur={() => setOpen(false)}
        className={cn(
          "group flex cursor-pointer items-center justify-between gap-2 text-left aria-[invalid=true]:border-brand disabled:cursor-not-allowed disabled:opacity-60 data-[state=open]:border-brand",
          className,
        )}
      >
        {renderValue ? (
          renderValue(selected)
        ) : (
          <span lang={selected?.lang} className={cn("min-w-0 flex-1 truncate", !selected && "text-muted-foreground")}>
            {selected?.label ?? placeholder ?? ""}
          </span>
        )}
        {ariaBusy === true ? (
          <Loader2 aria-hidden className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown
            aria-hidden
            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"
          />
        )}
      </button>

      <select
        ref={nativeRef}
        name={name}
        form={form}
        value={value}
        defaultValue={defaultValue}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(e) => {
          setOwn(e.target.value);
          onChange?.(e);
        }}
      >
        {children}
      </select>

      {open && (
        <div
          ref={panelRef}
          id={listId}
          role="listbox"
          popover="manual"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabel ? undefined : ariaLabelledBy ?? id}
          onMouseDown={(e) => e.preventDefault()}
          className="fixed inset-auto z-[70] m-0 w-max max-w-[min(26rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface p-1.5 text-foreground shadow-lg duration-100 animate-in fade-in-0 zoom-in-95 data-[side=bottom]:origin-top data-[side=top]:origin-bottom motion-reduce:animate-none"
        >
          {groups.map((group, g) => {
            const headingId = `${uid}-group-${g}`;
            return (
              <div key={headingId} role={group.label ? "group" : undefined} aria-labelledby={group.label ? headingId : undefined}>
                {group.label && (
                  <div id={headingId} className="flex items-center gap-2.5 px-2.5 pb-1 pt-2.5 first:pt-1.5">
                    {group.tile && (
                      <span
                        aria-hidden
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background font-display text-xs font-bold text-foreground"
                      >
                        {group.tile}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-foreground">{group.label}</span>
                      {group.hint && <span className="block text-xs text-muted-foreground">{group.hint}</span>}
                    </span>
                  </div>
                )}
                {group.options.map((option) => {
                  const index = ++row;
                  const chosen = option.value === current && selected !== undefined;
                  return (
                    <div
                      key={option.value}
                      id={optionId(index)}
                      role="option"
                      aria-selected={chosen}
                      aria-disabled={option.disabled || undefined}
                      data-index={index}
                      lang={option.lang}
                      onClick={() => !option.disabled && choose(option.value)}
                      onPointerMove={() => {
                        if (option.disabled) return;
                        hovering.current = true;
                        setActive(index);
                      }}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm transition-colors sm:py-2",
                        option.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                        index === active && "bg-muted",
                        chosen && "font-medium text-brand-soft",
                      )}
                    >
                      <span className="min-w-0 flex-1">{option.label}</span>
                      {option.detail && <span className="shrink-0 text-xs font-normal tabular-nums text-muted-foreground">{option.detail}</span>}
                      <Check aria-hidden className={cn("h-4 w-4 shrink-0", !chosen && "invisible")} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
});
