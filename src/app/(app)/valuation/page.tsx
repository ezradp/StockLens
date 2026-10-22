import Link from "next/link";
import { Calculator } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEnvStatus } from "@/lib/env";
import { getDcfContext, listValuationScenarios } from "@/server/dcf";
import { ValuationView } from "./valuation-view";

export const metadata = {
  title: "DCF Valuation",
};

export const instant = false; // data dinamis milik bersama + skenario user

interface PageProps {
  searchParams: Promise<{ ticker?: string }>;
}

export default async function ValuationPage({ searchParams }: PageProps) {
  const status = getEnvStatus();
  const { ticker: rawTicker } = await searchParams;
  const ticker = (rawTicker ?? "").toUpperCase();

  if (!status.supabaseConfigured) {
    return (
      <>
        <PageHeader
          title="DCF Valuation"
          subtitle="Estimasi nilai intrinsik dengan kalkulasi internal — tanpa API eksternal"
        />
        <EmptyState
          icon={Calculator}
          title="Valuasi menunggu koneksi Supabase"
          description="Isi kredensial Supabase di .env, jalankan migrasi dan seed. Engine DCF hanya menghitung di atas data tersimpan + asumsi manual Anda."
          phase="Fase 6 — DCF Engine"
        />
      </>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: companies } = await supabase
    .from("companies")
    .select("id, ticker, name, sector")
    .order("ticker")
    .limit(200);

  if ((companies ?? []).length === 0) {
    return (
      <>
        <PageHeader
          title="DCF Valuation"
          subtitle="Estimasi nilai intrinsik dengan kalkulasi internal — tanpa API eksternal"
        />
        <EmptyState
          icon={Calculator}
          title="Belum ada perusahaan di database"
          description="Jalankan npm run db:seed (SEC EDGAR, gratis) atau impor CSV — DCF menghitung dari data tersimpan, bukan angka demo."
        />
      </>
    );
  }

  if (ticker === "") {
    return (
      <>
        <PageHeader
          title="DCF Valuation"
          subtitle="Pilih perusahaan untuk memulai kalkulasi nilai intrinsik"
        />
        <p className="mb-4 text-xs text-muted-foreground">
          Asumsi default di halaman valuasi diambil otomatis dari laporan tersimpan perusahaan.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(companies ?? [])
            .map((row) => ({ ticker: row.ticker, name: row.name, sector: row.sector }))
            .map((row) => (
              <li key={row.ticker}>
                <Link
                  href={`/valuation?ticker=${encodeURIComponent(row.ticker)}`}
                  className="flex h-full flex-col justify-between rounded-xl border border-border bg-card/40 px-4 py-3 transition-colors hover:border-foreground/25"
                >
                  <span>
                    <span className="text-base font-semibold tracking-tight">{row.ticker}</span>
                    <span className="block text-xs text-muted-foreground">{row.name}</span>
                  </span>
                  {row.sector ? <span className="mt-2 text-xs text-muted-foreground">{row.sector}</span> : null}
                </Link>
              </li>
            ))}
        </ul>
      </>
    );
  }

  const context = await getDcfContext(ticker);
  if (!context) {
    return (
      <>
        <PageHeader
          title="DCF Valuation"
          subtitle="Estimasi nilai intrinsik dengan kalkulasi internal — tanpa API eksternal"
        />
        <EmptyState
          icon={Calculator}
          title={`Perusahaan ${ticker} tidak ada di database`}
          description="Cek ticker di halaman Stock Explorer — daftar perusahaan berasal dari tabel companies yang sama."
        />
      </>
    );
  }

  const scenarios = await listValuationScenarios(context.company.id);

  return (
    <>
      <PageHeader
        title={`DCF — ${context.company.ticker} ${context.company.name}`}
        subtitle="Kalkulasi internal: semua asumsi ditampilkan; data historis dari database StockLens"
      >
        <Link href="/valuation" className="text-xs text-muted-foreground hover:text-foreground">
          ← pilih perusahaan lain
        </Link>
      </PageHeader>
      <ValuationView context={context} scenarios={scenarios} />
    </>
  );
}
