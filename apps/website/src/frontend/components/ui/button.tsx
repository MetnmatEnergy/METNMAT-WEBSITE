import * as React from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/frontend/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        brand:
          "bg-brand text-brand-foreground shadow-md shadow-brand/20 hover:bg-brand/90 hover:shadow-lg hover:shadow-brand/25",
        outline:
          "border border-border bg-transparent text-foreground hover:border-foreground/25 hover:bg-surface",
        ghost: "text-foreground hover:bg-surface",
        subtle: "bg-surface text-foreground hover:bg-muted",
      },
      size: {
        sm: "h-9 px-4",
        md: "h-11 px-6",
        lg: "h-12 px-7 text-base",
        icon: "h-10 w-10 rounded-full p-0",
      },
    },
    defaultVariants: { variant: "brand", size: "md" },
  }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    href?: string;
  };

export function Button({ className, variant, size, href, ...props }: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  if (href) {
    // Forward passthrough props (data-track, aria-*, title, id…) to the anchor
    // too — previously only onClick/children survived, so a data-track on a link
    // Button was silently dropped and never reached the analytics click listener.
    const { children, onClick, ...rest } = props;
    return (
      <Link
        href={href}
        className={classes}
        onClick={onClick as React.MouseEventHandler<HTMLAnchorElement> | undefined}
        // rest is typed for a button; the passthrough we care about (data-*,
        // aria-*, title, id) is valid on an anchor. Cast to satisfy Link's props.
        {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {children}
      </Link>
    );
  }
  return <button className={classes} {...props} />;
}

export { buttonVariants };
