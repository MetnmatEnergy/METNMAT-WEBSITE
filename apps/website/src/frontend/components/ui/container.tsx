import { cn } from "@/frontend/lib/utils";

export function Container({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("container mx-auto", className)} {...props} />
  );
}
