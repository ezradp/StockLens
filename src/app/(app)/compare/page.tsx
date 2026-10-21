import { GitCompare } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";

export const metadata = {
  title: "Compare Stocks",
};

export default function ComparePage() {
  return (
    <>
      <PageHeader
        title="Compare Stocks"
        subtitle="Bandingkan 2–5 perusahaan dengan periode dan satuan yang sebanding"
      />
      <EmptyState
        icon={GitCompare}
        title="Perbandingan menunggu data tersimpan"
        description="Revenue, growth, margin, ROE/ROA, debt-to-equity, P/E & P/B, free cash flow, dan historical returns. Nilai yang tidak tersedia ditampilkan N/A — tidak pernah berupa angka buatan."
        phase="Fase 5 — Screener & Comparison"
      />
    </>
  );
}
