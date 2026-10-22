import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  /** Sediakan hanya bila percobaan ulang masuk akal — tidak ada tombol tak berfungsi. */
  onRetry?: () => void;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  title = "Terjadi kesalahan",
  description = "Data tidak dapat dimuat saat ini. Coba lagi beberapa saat.",
  onRetry,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 rounded-[var(--radius-card)] border-l-2 border-negative bg-[var(--pill-negative-bg)] px-4 py-3",
        className,
      )}
      role="alert"
    >
      <p className="flex items-center gap-2 text-[13px] font-medium text-[color:var(--pill-negative-ink)]">
        <TriangleAlert className="h-4 w-4" aria-hidden="true" />
        {title}
      </p>
      <p className="max-w-[60ch] text-xs leading-5 text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          Coba lagi
        </Button>
      ) : null}
      {action}
    </div>
  );
}
