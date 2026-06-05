import { cn } from "@/frontend/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "brand" | "dot";
};

export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium",
        variant === "brand" && "border-brand/30 bg-brand/10 text-brand-soft",
        className
      )}
      {...props}
    >
      {variant === "dot" && (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      )}
      {children}
    </span>
  );
}
