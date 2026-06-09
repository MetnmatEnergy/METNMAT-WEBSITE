"use client";

import { FileText, ArrowRight } from "lucide-react";
import { useQuote, type QuoteProductRef } from "@/frontend/components/commerce/quote-provider";
import { cn } from "@/frontend/lib/utils";

/** Opens the quote drawer for a specific product. */
export function RequestQuoteButton({
  product,
  className,
  variant = "outline",
  withIcon = false,
}: {
  product: QuoteProductRef;
  className?: string;
  variant?: "outline" | "brand";
  withIcon?: boolean;
}) {
  const { openQuote } = useQuote();
  return (
    <button
      type="button"
      onClick={() => openQuote(product)}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
        variant === "brand"
          ? "bg-brand text-brand-foreground hover:bg-brand/90"
          : "border border-border hover:bg-muted",
        className
      )}
    >
      {withIcon && <FileText className="h-4 w-4" />}
      Request for Customization
    </button>
  );
}

/**
 * Opens the customization / quote drawer (no specific product). Used by every
 * "Get a Quote" / "Request a bulk quote" CTA across the site so they all open
 * the same slide-in form. Configurable label, size and trailing arrow.
 */
export function GetQuoteButton({
  className,
  label = "Get a Quote",
  size = "md",
  withArrow = false,
}: {
  className?: string;
  label?: string;
  size?: "md" | "lg";
  withArrow?: boolean;
}) {
  const { openModal } = useQuote();
  return (
    <button
      type="button"
      onClick={() => openModal()}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full bg-brand font-semibold text-brand-foreground transition-colors hover:bg-brand/90",
        size === "lg" ? "h-12 px-7 text-sm" : "h-11 px-6 text-sm",
        className
      )}
    >
      {label}
      {withArrow && <ArrowRight className="h-4 w-4" />}
    </button>
  );
}
