import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[var(--radius-chip)] border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-[var(--pill-neutral-bg)] text-[color:var(--pill-neutral-ink)]",
        outline: "border-border bg-transparent text-muted-foreground",
        success:
          "border-transparent bg-[var(--pill-positive-bg)] text-[color:var(--pill-positive-ink)]",
        danger:
          "border-transparent bg-[var(--pill-negative-bg)] text-[color:var(--pill-negative-ink)]",
        warning: "border-transparent bg-[var(--pill-warning-bg)] text-[color:var(--pill-warning-ink)]",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
