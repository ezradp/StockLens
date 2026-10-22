import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lightbulb, LineChart, Table2 } from "lucide-react";
import { computeFundamentals } from "@/engine/fundamentals";
import { buildScreenerRows, type ScreenerSourceRow } from "@/engine/screener";
import { buildInsights, insightCoverage, type Insight } from "@/engine/insights";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { PriceChart, type PricePoint } from "@/components/charts/price-chart";
import { StatementTableCard, buildStatementTable } from "@/components/tables/statement-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEnvStatus } from "@/lib/env";
import { formatCompactCurrency, formatPercent, formatDate } from "@/lib/format";
import { getCompanyDetail } from "@/server/companies";
import type { StatementKind, StatementSnapshot } from "@/engine/fundamentals";

interface PageProps {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { ticker } = await params;
  return { title: `${decodeURIComponent(ticker).toUpperCase()} — Stock Explorer` };
}

const MAX_STATEMENT_COLUMNS = 6;

export const instant = false; // server-rendered per request (data milik user + bersama)

export default async function CompanyDetailPage({ params }: PageProps) {
  const status = getEnvStatus();
  const { ticker: rawTicker } = await params;
  const ticker = decodeURIComponent(rawTicker).toUpperCase();

  if (status.supabaseConfigured) {
    const detail = await getCompanyDetail(ticker);
    if (detail) {
      return <CompanyDetail detail={detail} />;
    }
  }

  notFound();
}

function CompanyDetail({
  detail,
}: {
  detail: NonNullable<Awaited<ReturnType<typeof getCompanyDetail>>>;
}) {
  const { company, statements, prices } = detail;
  const fundamentals = computeFundamentals(statements);

  const sortedPrices: PricePoint[] = [...prices].sort((a, b) => a.date.localeCompare(b.date));
  const latestPrice = sortedPrices.at(-1) ?? null;

  // Kolom periode: income paling lengkap; di-cop 6 tahun terbaru.
  const periodEnds = [
    ...new Set(
      statements
        .filter((s) => s.statementType === "income_statement")
        .map((s) => s.periodEnd),
    ),
  ]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, MAX_STATEMENT_COLUMNS);

  const byKind = (kind: StatementKind): StatementSnapshot[] =>
    statements.filter((statement) => statement.statementType === kind);

  const compactFormatter = (value: number): string => formatCompactCurrency(value, company.currency);

  const incomeTable = buildStatementTable(
    "Laporan Laba Rugi",
    byKind("income_statement"),
    periodEnds,
    compactFormatter,
    [
      { label: "Pendapatan", key: "revenue" },
      { label: "Laba kotor", key: "gross_profit" },
      { label: "Laba operasi", key: "operating_income" },
      { label: "Laba bersih", key: "net_income" },
    ],
  );

  const balanceTable = buildStatementTable(
    "Neraca",
    byKind("balance_sheet"),
    periodEnds,
    compactFormatter,
    [
      { label: "Total aset", key: "total_assets" },
      { label: "Total liabilitas", key: "total_liabilities" },
      { label: "Total ekuitas", key: "total_equity" },
      { label: "Kas & setara", key: "cash" },
    ],
  );

  const cashflowRows = byKind("cash_flow");
  // FCF turunan per periode — ditandai eksplisit sebagai metrik turunan.
  const cashflowTable = buildStatementTable(
    "Arus Kas",
    cashflowRows,
    periodEnds,
    (value) => compactFormatter(value),
    [
      { label: "Kas dari operasi", key: "operating_cash_flow" },
      { label: "Capex", key: "capex" },
      { label: "Arus kas bebas (turunan)", key: "free_cash_flow" },
    ],
  );

  const metricCards: Array<{ label: string; value: string; note: string }> = [
    { label: "Margin laba bersih", value: formatPercent(fundamentals.netMargin), note: "laba bersih ÷ pendapatan" },
    { label: "Margin operasi", value: formatPercent(fundamentals.operatingMargin), note: "laba operasi ÷ pendapatan" },
    { label: "ROE", value: formatPercent(fundamentals.roe), note: "laba bersih ÷ ekuitas periode sejajar" },
    { label: "Pertumbuhan pendapatan (1 th)", value: formatPercent(fundamentals.revenueGrowth1y, { signed: true }), note: "vs tahun sejajar sebelumnya" },
    { label: "Pendapatan CAGR 3 th", value: formatPercent(fundamentals.revenueGrowth3y, { signed: true }), note: "bila span 3 tahun tersedia" },
    { label: "Pertumbuhan laba (1 th)", value: formatPercent(fundamentals.netIncomeGrowth1y, { signed: true }), note: "vs tahun sejajar sebelumnya" },
  ];

  const anyStatements = statements.length > 0;

  // Wawasan memakai jalur yang sama dengan screener (kode tunggal, tanpa duplikasi):
  // build ulang ScreenerRow untuk SATU perusahaan dari data yang sudah terambil.
  const insightSource: ScreenerSourceRow = {
    meta: {
      id: company.id,
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      currency: company.currency,
    },
    statements,
    // Hanya 401 bar terakhir — cukup untuk return 1 th ± patokan.
    prices: sortedPrices.slice(-401).map((point) => ({ date: point.date, close: point.close })),
  };
  const insightRow = buildScreenerRows([insightSource])[0] ?? null;
  const insights = insightRow ? buildInsights(insightRow) : [];
  const coverageMissing = insightRow ? insightCoverage(insightRow) : [];

  const TONE_TEXT: Record<Insight["tone"], string> = {
    positive: "text-green-400",
    neutral: "text-muted-foreground",
    caution: "text-amber-400",
  };
  const TONE_LABEL: Record<Insight["tone"], string> = {
    positive: "positif",
    neutral: "netral",
    caution: "kewaspadaan",
  };


  return (
    <>
      <Link
        href="/explorer"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Kembali ke daftar
      </Link>

      <PageHeader
        title={`${company.ticker} — ${company.name}`}
        subtitle={`${company.sector ?? "Sektor tidak tercatat"}${company.industry ? ` · SIC ${company.industry}` : ""} · ${company.currency}`}
      >
        {latestPrice ? (
          <Badge variant="secondary" className="tnum">
            Terakhir: {formatCompactCurrency(latestPrice.close, company.currency)} ({formatDate(latestPrice.date)})
          </Badge>
        ) : null}
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-4 w-4" aria-hidden="true" />
            Harga (candlestick + volume)
          </CardTitle>
          <CardDescription>
            {sortedPrices.length > 0
              ? `${sortedPrices.length} bar (${formatDate(sortedPrices[0]?.date)} — ${formatDate(latestPrice!.date)}); sumber data terlabel, bukan real-time.`
              : "Belum ada data harga untuk perusahaan ini."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedPrices.length > 0 ? (
            <PriceChart points={sortedPrices} />
          ) : (
            <EmptyState
              icon={LineChart}
              title="Tidak ada baris harga"
              description="Isi via CSV Import (jalur utama) atau seed Tiingo bila Anda punya free key (PRICE_PROVIDER_API_KEY)."
              action={
                <Link href="/import" className="text-xs text-primary hover:underline">
                  Buka Data Import →
                </Link>
              }
            />
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metricCards.map((metric) => (
          <Card key={metric.label}>
            <CardContent>
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <p className="tnum mt-1 text-xl font-semibold">{metric.value}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{metric.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {anyStatements ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <StatementTableCard data={incomeTable} />
          <StatementTableCard data={balanceTable} />
          <StatementTableCard
            data={{
              ...cashflowTable,
              note: "Baris “Arus kas bebas” dihitung server: kas operasi − |capex| per periode.",
            }}
          />
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState
            icon={Table2}
            title="Belum ada laporan keuangan tersimpan"
            description="Jalankan npm run db:seed (SEC EDGAR, gratis) atau impor CSV fondamen di halaman Data Import."
            action={
              <Link href="/import" className="text-xs text-primary hover:underline">
                Buka Data Import →
              </Link>
            }
          />
        </div>
      )}

      {insights.length > 0 ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" aria-hidden="true" />
              Wawasan (aturan tetap)
            </CardTitle>
            <CardDescription>
              Aturan yang sama untuk semua perusahaan — transparan & diaudit dari kode,
              bukan AI. {coverageMissing.length > 0
                ? `Tanpa data: ${coverageMissing.join(", ")} — aturan terkait tidak menyala (tidak dipalsukan).`
                : "Semua metrik kunci tersedia."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {insights.map((insight) => (
                <li key={insight.ruleId} className="flex items-start gap-2">
                  <span className="mt-1 text-xs text-muted-foreground">
                    {TONE_LABEL[insight.tone]}
                  </span>
                  <span
                    aria-hidden="true"
                    className={
                      insight.tone === "positive"
                        ? "mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500"
                        : insight.tone === "caution"
                          ? "mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                          : "mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400"
                    }
                  />
                  <span className={TONE_TEXT[insight.tone]}>
                    {insight.text}
                    <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                      {insight.ruleId}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
