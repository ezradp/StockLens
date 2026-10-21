import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
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
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? <Icon className="h-8 w-8 text-muted-foreground" aria-hidden="true" /> : null}
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        {description ? (
          <p className="mx-auto max-w-md text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {phase || action ? (
        <div className="flex items-center gap-2">
          {phase ? <Badge variant="outline">{phase}</Badge> : null}
          {action}
        </div>
      ) : null}
    </div>
  );
}
