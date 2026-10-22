import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { getEnvStatus } from "@/lib/env";
import { getPortfolioBundle, listPortfolios } from "@/server/portfolio";
import { PortfolioView } from "./portfolio-view";

export const metadata = {
  title: "Portfolio",
};

export const instant = false; // data personal per user, dinamis

interface PageProps {
  searchParams: Promise<{ id?: string }>;
}

export default async function PortfolioPage({ searchParams }: PageProps) {
  const status = getEnvStatus();
  const { id: rawId } = await searchParams;
  const activeId = rawId && /^[0-9a-f-]{36}$/i.test(rawId) ? rawId : null;

  if (!status.supabaseConfigured) {
    return (
      <>
        <PageHeader title="Portfolio" subtitle="Transaksi, cost basis, P/L, dan alokasi aset" />
        <EmptyState
          icon={Wallet}
          title="Portfolio menunggu koneksi Supabase"
          description="Isi NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY di .env. Tabel portfolios & portfolio_transactions sudah disiapkan migrasi — tidak ada data demo."
          phase="Fase 7 — Portfolio Tracker"
        />
      </>
    );
  }

  const portfolios = await listPortfolios();

  if (portfolios.length === 0) {
    return (
      <>
        <PageHeader title="Portfolio" subtitle="Transaksi, cost basis, P/L, dan alokasi aset" />
        <PortfolioView portfolios={[]} activeId={null} bundle={null} />
      </>
    );
  }

  const bundle =
    activeId !== null ? await getPortfolioBundle(activeId) : null;

  return (
    <>
      <PageHeader
        title="Portfolio"
        subtitle="Transaksi, cost basis rata-rata, P/L terwujud & tak terwujud, alokasi"
      />
      <PortfolioView
        portfolios={portfolios.map((p) => ({ id: p.id, name: p.name, baseCurrency: p.baseCurrency }))}
        activeId={bundle ? bundle.portfolio.id : null}
        bundle={bundle}
      />
    </>
  );
}
