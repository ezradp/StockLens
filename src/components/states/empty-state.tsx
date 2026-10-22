import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Label fase roadmap ke mana fitur ini akan datang, mis. "Fase 4 — Stock Explorer". */
  phase?: string;
  /** Aksi nyata (bukan dekorasi) — mis. tombol menuju Data Import. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  phase,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 border-t border-rule px-6 py-10 text-center",
        className,
      )}
    >
      <p className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
        {Icon ? <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : null}
        {title}
      </p>
      {description ? (
        <p className="mx-auto max-w-[52ch] text-xs leading-5 text-muted-foreground">{description}</p>
      ) : null}
      {phase || action ? (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
          {phase ? <span>{phase}</span> : null}
          {action}
        </div>
      ) : null}
    </div>
  );
}
