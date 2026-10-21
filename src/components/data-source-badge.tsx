import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Label sumber data yang bisa dipetakan apa adanya (PRD §6: DataSourceBadge). */
export const SOURCE_LABELS: Record<string, string> = {
  seed: "Data historis (seed)",
  provider: "Data historis (API)",
  import: "Impor pengguna",
  manual: "Input manual",
  calculated: "Dihitung dari data",
  demo: "Demo",
};

interface DataSourceBadgeProps {
  /** Nilai source_type/source_name di database; label tidak dikenal ditampilkan apa adanya. */
  source: string;
  /** Timestamp data diperoleh — ditampilkan sebagai tooltip.  */
  fetchedAt?: string;
  className?: string;
}

export function DataSourceBadge({ source, fetchedAt, className }: DataSourceBadgeProps) {
  const label = SOURCE_LABELS[source] ?? source;
  return (
    <Badge
      variant="outline"
      title={fetchedAt ? `${label} — terakhir diperbarui: ${fetchedAt}` : label}
      className={cn("cursor-default", className)}
    >
      <Info className="h-3 w-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}
