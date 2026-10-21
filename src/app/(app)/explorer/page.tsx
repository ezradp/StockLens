import { Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";

export const metadata = {
  title: "Stock Explorer",
};

export default function ExplorerPage() {
  return (
    <>
      <PageHeader
        title="Stock Explorer"
        subtitle="Cari perusahaan berdasarkan ticker atau nama, telusuri fundamental dan performa"
      />
      <EmptyState
        icon={Search}
        title="Explorer menunggu data tersimpan"
        description="Halaman detail perusahaan (Company Overview, Financials tahunan/kuartalan, Fundamental metrics, Performance chart) akan bekerja penuh di atas data seed historis maupun hasil CSV Import — tanpa API eksternal."
        phase="Fase 4 — Stock Explorer"
      />
    </>
  );
}
