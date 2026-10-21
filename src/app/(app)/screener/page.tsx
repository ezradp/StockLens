import { SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";

export const metadata = {
  title: "Screener",
};

export default function ScreenerPage() {
  return (
    <>
      <PageHeader
        title="Screener"
        subtitle="Filter gabungan atas data fundamental yang benar-benar tersimpan"
      />
      <EmptyState
        icon={SlidersHorizontal}
        title="Screener menunggu data tersimpan"
        description="Filter valuation (P/E, P/B, EV/EBITDA), profitability (ROE, ROA, margin), growth, financial health (D/E, current ratio), size, dan dividend — lengkap dengan sorting, pagination, saved screens, dan fundamental scoring. Cakupan data ditampilkan apa adanya."
        phase="Fase 5 — Screener & Comparison"
      />
    </>
  );
}
