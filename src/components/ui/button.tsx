import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-raised text-foreground hover:bg-raised/75",
        outline:
          "border border-control bg-transparent text-foreground hover:border-muted-foreground hover:bg-raised/50",
        ghost: "text-muted-foreground hover:bg-raised/60 hover:text-foreground",
        destructive:
          "border border-negative/30 bg-[var(--pill-negative-bg)] text-[color:var(--pill-negative-ink)] hover:border-negative/60",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-[var(--control-height)] px-4",
        lg: "h-10 px-5",
        icon: "h-[var(--control-height)] w-[var(--control-height)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}

export { buttonVariants };
