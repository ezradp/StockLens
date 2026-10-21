import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Kerangka statis halaman dashboard: 4 kartu metrik + panel chart + tabel ringkas. */
export function LoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)} aria-busy="true" aria-live="polite">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-border bg-card p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <div className="space-y-2 rounded-xl border border-border bg-card p-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}
