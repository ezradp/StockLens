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
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-danger/30 bg-danger/5 px-6 py-12 text-center",
        className,
      )}
      role="alert"
    >
      <TriangleAlert className="h-8 w-8 text-danger" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mx-auto max-w-md text-xs text-muted-foreground">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Coba lagi
        </Button>
      ) : null}
      {action}
    </div>
  );
}
