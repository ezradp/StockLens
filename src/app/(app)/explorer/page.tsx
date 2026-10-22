import Link from "next/link";
import { Database } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SetupRequired } from "@/components/setup-required";
import { buttonVariants } from "@/components/ui/button";
import { getEnvStatus } from "@/lib/env";
import { listCompanySummaries } from "@/server/companies";
import { ExplorerList } from "./explorer-list";

export const metadata = {
  title: "Stock Explorer",
};

export const instant = false; // daftar perusahaan dinamis dari database

export default async function ExplorerPage() {
  const status = getEnvStatus();

  if (!status.supabaseConfigured) {
    return (
      <>
        <PageHeader title="Stock Explorer" subtitle="Telusuri fundamental & harga perusahaan" />
        <SetupRequired
          steps={[
            {
              title: "Isi .env Supabase",
              description: "NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY untuk koneksi aplikasi.",
            },
            {
              title: "Jalankan migrasi & seed",
              description: "npm run db:migrate lalu npm run db:seed (SEC EDGAR, gratis) untuk mengisi perusahaan & laporan keuangan.",
            },
          ]}
        />
      </>
    );
  }

  const companies = await listCompanySummaries();

  if (companies.length === 0) {
    return (
      <>
        <PageHeader title="Stock Explorer" subtitle="Telusuri fundamental & harga perusahaan" />
        <p className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          Master perusahaan masih kosong. Jalankan <code>npm run db:seed</code> (SEC EDGAR, gratis)
          atau masukkan data sendiri lewat halaman import.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Link href="/import" className={buttonVariants({ variant: "outline" })}>
            Buka Data Import
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Stock Explorer"
        subtitle="Cari ticker/nama, buka detail perusahaan: harga, laporan, metrik turunan"
      />
      <ExplorerList companies={companies} />
      <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
        <Database className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Semua angka berasal dari database StockLens (seed SEC EDGAR / harga provider / CSV milik
        Anda) — diberi label sumber di halaman detail. Tidak ada angka real-time di sini, dan tidak
        ada angka palsu.
      </p>
    </>
  );
}
