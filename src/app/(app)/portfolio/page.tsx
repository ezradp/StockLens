import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";

export const metadata = {
  title: "Portfolio",
};

export default function PortfolioPage() {
  return (
    <>
      <PageHeader
        title="Portfolio"
        subtitle="Transaksi, cost basis, P/L, dan alokasi aset"
      />
      <EmptyState
        icon={Wallet}
        title="Portfolio tracker menunggu implementasi"
        description="Catat buy/sell/deposit/withdrawal/dividend/fee, lihat holdings dengan average-cost basis, unrealized & realized P/L, alokasi per aset/sektor, dan grafik performa. Deposit/withdrawal tidak pernah dihitung sebagai keuntungan investasi."
        phase="Fase 7 — Portfolio Tracker"
      />
    </>
  );
}
