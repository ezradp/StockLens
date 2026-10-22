import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Slot kanan (aksi/tombol). */
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, children, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold leading-8 tracking-[-0.02em] text-foreground">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 max-w-[68ch] text-[13px] leading-5 text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {children ? <div className="flex items-center gap-1.5">{children}</div> : null}
    </div>
  );
}
