import { GitCompare } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { getEnvStatus } from "@/lib/env";
import { getScreenerBundle } from "@/server/screener";
import { CompareView } from "./compare-view";

export const metadata = {
  title: "Compare Stocks",
};

export const instant = false; // data dinamis milik bersama

export default async function ComparePage() {
  const status = getEnvStatus();

  if (!status.supabaseConfigured) {
    return (
      <>
        <PageHeader
          title="Compare Stocks"
          subtitle="Bandingkan 2–5 perusahaan dengan satuan dan periode apa adanya"
        />
        <EmptyState
          icon={GitCompare}
          title="Perbandingan menunggu koneksi Supabase"
          description="Isi kredensial Supabase di .env, jalankan migrasi dan seed. Tidak ada data demo — grafik tabel hanya hidup di atas data nyata yang tersimpan."
          phase="Fase 5 — Screener & Comparison"
        />
      </>
    );
  }

  const rows = await getScreenerBundle();

  if (rows.length === 0) {
    return (
      <>
        <PageHeader
          title="Compare Stocks"
          subtitle="Bandingkan 2–5 perusahaan dengan satuan dan periode apa adanya"
        />
        <EmptyState
          icon={GitCompare}
          title="Belum ada perusahaan di database"
          description="Jalankan npm run db:seed (SEC EDGAR, gratis) atau impor CSV; perbandingan dihitung dari data tersimpan, bukan angka demo."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Compare Stocks"
        subtitle="Bandingkan 2–5 perusahaan: valuasi, profitabilitas, pertumbuhan, kesehatan fiskal"
      />
      <CompareView rows={rows} />
    </>
  );
}
