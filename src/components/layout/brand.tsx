import Link from "next/link";
import { cn } from "@/lib/utils";

/** Mark "lens + data": lensa (lingkaran + gagang) dengan silang bidik di dalamnya. */
export function LensMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="10.5" cy="10.5" r="6.25" />
      <path d="m15.2 15.2 4.8 4.8" />
      <path d="M7.5 10.5h6M10.5 7.5v6" />
    </svg>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/overview"
      className={cn("group flex items-center gap-2.5 text-foreground", className)}
    >
      <LensMark className="h-5 w-5 shrink-0 text-accent" />
      <span className="text-[15px] font-semibold tracking-[-0.01em]">StockLens</span>
    </Link>
  );
}
