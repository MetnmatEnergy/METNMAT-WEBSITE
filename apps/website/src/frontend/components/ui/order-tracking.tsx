"use client";

import * as React from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/frontend/lib/utils";

/**
 * Vertical order-tracking timeline (shadcn-style, adapted from 21st.dev).
 *
 * Codebase adaptations vs the original:
 *  - `cn` lives at @/frontend/lib/utils in this project (not @/lib/utils);
 *  - this theme has no `primary` token — the site's accent is `brand`, so the
 *    original text-primary/70 classes would have silently rendered unstyled;
 *  - `timestamp` is optional: steps are built from REAL order/shipment fields
 *    (createdAt, paidAt, dispatchedAt, deliveredAt) that staff set in the CMS,
 *    and a completed legacy step may genuinely have no recorded time;
 *  - the connector line reflects the NEXT step's completion (as designed), and
 *    an ordered list + aria labels make the sequence real for screen readers.
 */
export interface OrderTrackingStep {
  name: string;
  /** Human-formatted time, or "Pending" for steps not reached yet. */
  timestamp?: string;
  isCompleted: boolean;
}

export interface OrderTrackingProps extends React.HTMLAttributes<HTMLDivElement> {
  steps: OrderTrackingStep[];
}

const OrderTracking = React.forwardRef<HTMLDivElement, OrderTrackingProps>(
  ({ steps = [], className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("w-full max-w-md", className)} {...props}>
        {steps.length > 0 ? (
          <ol aria-label="Order progress">
            {steps.map((step, index) => (
              <li key={index} className="flex">
                <div className="flex flex-col items-center" aria-hidden>
                  {step.isCompleted ? (
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-brand" />
                  ) : (
                    <Circle className="h-6 w-6 shrink-0 text-muted-foreground/50" />
                  )}
                  {index < steps.length - 1 && (
                    <div
                      className={cn("w-[1.5px] grow", {
                        "bg-brand": steps[index + 1].isCompleted,
                        "bg-border": !steps[index + 1].isCompleted,
                      })}
                    />
                  )}
                </div>
                <div className={cn("ml-3", index < steps.length - 1 && "pb-6")}>
                  <p className={cn("text-sm font-medium", !step.isCompleted && "text-muted-foreground")}>
                    {step.name}
                    <span className="sr-only">{step.isCompleted ? " — completed" : " — not yet"}</span>
                  </p>
                  {step.timestamp ? (
                    <p className="text-sm text-muted-foreground">{step.timestamp}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-foreground/80">This order has no tracking information.</p>
        )}
      </div>
    );
  }
);
OrderTracking.displayName = "OrderTracking";

export { OrderTracking };
