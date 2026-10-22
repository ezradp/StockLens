import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Kerangka statis: strip KPI + panel chart + tabel ringkas. */
export function LoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)} aria-busy="true" aria-live="polite">
      <div className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-card)] bg-card md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 border-b border-rule px-5 py-4 md:border-b-0 md:border-r">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="rounded-[var(--radius-card)] bg-card p-5">
        <Skeleton className="h-64 w-full" />
      </div>
      <div className="space-y-1 rounded-[var(--radius-card)] bg-card p-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}
