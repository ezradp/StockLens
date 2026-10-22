import { SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { getEnvStatus } from "@/lib/env";
import { getScreenerBundle } from "@/server/screener";
import { listSavedScreens } from "@/server/saved-screens";
import { ScreenerView } from "./screener-view";

export const metadata = {
  title: "Screener",
};

export const instant = false; // data dinamis milik bersama + layar tersimpan user

export default async function ScreenerPage() {
  const status = getEnvStatus();

  if (!status.supabaseConfigured) {
    return (
      <>
        <PageHeader
          title="Screener"
          subtitle="Filter gabungan atas data fundamental yang benar-benar tersimpan"
        />
        <EmptyState
          icon={SlidersHorizontal}
          title="Screener menunggu koneksi Supabase"
          description="Isi NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY di .env, jalankan migrasi dan seed. Tidak ada data demo — screener hanya hidup di atas data nyata."
        />
      </>
    );
  }

  const [rows, savedScreens] = await Promise.all([getScreenerBundle(), listSavedScreens()]);

  if (rows.length === 0) {
    return (
      <>
        <PageHeader
          title="Screener"
          subtitle="Filter gabungan atas data fundamental yang benar-benar tersimpan"
        />
        <EmptyState
          icon={SlidersHorizontal}
          title="Belum ada perusahaan di database"
          description="Jalankan npm run db:seed (SEC EDGAR, gratis) atau impor CSV fondamen di halaman Data Import — screener menghitung metrik hanya dari data tersimpan."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Screener"
        subtitle="Filter, sortir, dan skor fundamental atas seluruh data tersimpan — ditampilkan apa adanya"
      />
      <ScreenerView rows={rows} savedScreens={savedScreens} />
    </>
  );
}
