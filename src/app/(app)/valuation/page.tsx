import Link from "next/link";
import { Calculator } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
        <Card>
          <CardHeader>
            <CardTitle>Pilih emiten</CardTitle>
            <CardDescription>
              Asumsi default diambil otomatis dari laporan tersimpan perusahaan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
              {(companies ?? []).map((row) => (
                <li key={row.ticker}>
                  <Link
                    href={`/valuation?ticker=${encodeURIComponent(row.ticker)}`}
                    className="group flex items-baseline justify-between gap-3 border-b border-rule py-2.5"
                  >
                    <span className="text-[13px] font-semibold text-foreground">{row.ticker}</span>
                    <span
                      className="min-w-0 truncate text-[11px] text-muted-foreground transition-colors group-hover:text-foreground"
                      title={row.name}
                    >
                      {row.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
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
        title={`DCF · ${context.company.ticker}`}
        subtitle={`${context.company.name} — kalkulasi internal; semua asumsi ditampilkan, data historis dari database StockLens.`}
      >
        <Link href="/valuation" className="text-xs text-muted-foreground hover:text-foreground">
          ← pilih perusahaan lain
        </Link>
      </PageHeader>
      <ValuationView context={context} scenarios={scenarios} />
    </>
  );
}
