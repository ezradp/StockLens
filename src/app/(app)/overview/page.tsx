import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { SetupRequired } from "@/components/setup-required";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEnvStatus } from "@/lib/env";
import { getScreenerBundle } from "@/server/screener";
import { buildInsights, type Insight } from "@/engine/insights";
import { formatNumber } from "@/lib/format";

export const metadata = {
  title: "Overview",
};

export const instant = false; // feed dihitung dari database

const SETUP_STEPS = [
  {
    title: "Buat project Supabase (free tier)",
    description:
      "Di supabase.com buat project, lalu catat: Project URL, anon key, service role key, dan database connection string (Settings → API / Database).",
  },
  {
    title: "Isi file .env",
    description:
      "Salin .env.example menjadi .env, isi NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, DATABASE_URL, dan SUPABASE_SERVICE_ROLE_KEY.",
  },
  {
    title: "Jalankan migrasi database",
    description:
      'Perintah "npm run db:migrate" menerapkan seluruh migrasi SQL + RLS ke database (lokal atau Supabase) dan mencatat progresnya.',
  },
];

const TONE_DOT: Record<Insight["tone"], string> = {
  positive: "bg-positive",
  neutral: "bg-muted-foreground/60",
  caution: "bg-warning",
};

export default async function OverviewPage() {
  const status = getEnvStatus();

  if (!status.supabaseConfigured) {
    return (
      <>
        <PageHeader
          title="Overview"
          subtitle="Feed wawasan lintas perusahaan dari aturan tetap"
        />
        <SetupRequired
          steps={SETUP_STEPS}
          note="Aplikasi tetap aman tanpa kredensial: halaman-halaman data menampilkan state penyiapan sampai database terhubung."
        />
      </>
    );
  }

  const rows = await getScreenerBundle();

  if (rows.length === 0) {
    return (
      <>
        <PageHeader
          title="Overview"
          subtitle="Feed wawasan lintas perusahaan dari aturan tetap"
        />
        <EmptyState
          icon={Lightbulb}
          title="Feed wawasan kosong — belum ada perusahaan"
          description="Wawasan dihitung dari laporan keuangan + harga yang benar-benar tersimpan. Impor data perusahaan dulu; tidak ada data demo yang dipalsukan."
          phase="Aturan tetap transparan — tanpa AI"
        />
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Jalur data bisa disiapkan di menu{" "}
          <Link href="/import" className="text-foreground underline decoration-control underline-offset-4 hover:decoration-accent">
            Data Import
          </Link>
          .
        </p>
      </>
    );
  }

  const entries = rows.map((row) => {
    const insights = buildInsights(row);
    const top =
      insights.find((insight) => insight.tone === "caution") ??
      insights.find((insight) => insight.tone === "positive") ??
      insights.find((insight) => insight.tone === "neutral") ??
      null;
    return { row, insights, top };
  });

  const positiveTotal = entries.reduce(
    (sum, entry) => sum + entry.insights.filter((insight) => insight.tone === "positive").length,
    0,
  );
  const cautionTotal = entries.reduce(
    (sum, entry) => sum + entry.insights.filter((insight) => insight.tone === "caution").length,
    0,
  );
  const withStatements = entries.filter((entry) => entry.row.latestPeriodEnd !== null).length;
  const withPrice = entries.filter((entry) => entry.row.latestClose !== null).length;

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Feed wawasan lintas perusahaan — aturan tetap yang transparan, bukan AI"
      />

      <Card className="mb-6 overflow-hidden">
        <div className="grid grid-cols-2 divide-y divide-border md:grid-cols-4 md:divide-x md:divide-y-0">
          {[
            {
              label: "Perusahaan",
              value: String(entries.length),
              note: `${withStatements} dengan laporan sejajar`,
            },
            {
              label: "Wawasan positif",
              value: String(positiveTotal),
              note: "margin, ROE, FCF, pertumbuhan",
            },
            {
              label: "Wawasan kewaspadaan",
              value: String(cautionTotal),
              note: "kerugian, leverage, penurunan",
            },
            {
              label: "Harga tersedia",
              value: `${withPrice}/${entries.length}`,
              note: withPrice === 0 ? "kunci Tiingo belum diisi" : "harga EOD terkini",
            },
          ].map((cell) => (
            <div key={cell.label} className="px-5 py-4">
              <p className="text-[11px] leading-4 text-muted-foreground">{cell.label}</p>
              <p className="tnum mt-1.5 text-[20px] font-medium leading-6">{cell.value}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                {cell.note}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader className="flex-row items-baseline justify-between gap-4 pb-3">
          <CardTitle>Feed wawasan</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            {entries.length} emiten · aturan tetap
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto px-2 pb-2 pt-0">
          <table className="w-full table-fixed border-collapse text-left md:min-w-[860px] md:table-auto">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="h-9 px-2 text-[11px] font-normal text-muted-foreground">
                  Emiten
                </th>
                <th scope="col" className="hidden h-9 px-2 text-[11px] font-normal text-muted-foreground md:table-cell">
                  Sektor
                </th>
                <th scope="col" className="hidden h-9 px-2 text-right text-[11px] font-normal text-muted-foreground md:table-cell">
                  Skor
                </th>
                <th scope="col" className="hidden h-9 px-2 text-right text-[11px] font-normal text-muted-foreground md:table-cell">
                  Laporan
                </th>
                <th scope="col" className="hidden h-9 px-2 text-right text-[11px] font-normal text-muted-foreground md:table-cell">
                  Pos
                </th>
                <th scope="col" className="hidden h-9 px-2 text-right text-[11px] font-normal text-muted-foreground md:table-cell">
                  Was
                </th>
                <th scope="col" className="h-9 px-2 text-[11px] font-normal text-muted-foreground">
                  Wawasan teratas
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map(({ row, insights, top }) => {
                const positives = insights.filter((i) => i.tone === "positive").length;
                const cautions = insights.filter((i) => i.tone === "caution").length;
                const neutrals = insights.filter((i) => i.tone === "neutral").length;
                return (
                  <tr key={row.ticker} className="border-b border-rule last:border-b-0">
                    <td className="h-[42px] px-2">
                      <Link
                        href={`/explorer/${row.ticker}`}
                        className="text-[13px] font-semibold text-foreground decoration-accent/60 underline-offset-4 hover:underline"
                      >
                        {row.ticker}
                      </Link>
                      <span
                        className="ml-2 inline-block max-w-[150px] truncate align-bottom text-[11px] text-muted-foreground"
                        title={row.name}
                      >
                        {row.name}
                      </span>
                    </td>
                    <td className="hidden h-[42px] px-2 md:table-cell">
                      <span
                        className="block max-w-[150px] truncate text-xs text-muted-foreground"
                        title={row.sector ?? undefined}
                      >
                        {row.sector ?? "—"}
                      </span>
                    </td>
                    <td className="tnum hidden h-[42px] px-2 text-right text-[13px] md:table-cell">
                      {row.score === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        formatNumber(row.score, 0)
                      )}
                    </td>
                    <td className="tnum hidden h-[42px] px-2 text-right text-[11px] text-muted-foreground md:table-cell">
                      {row.latestPeriodEnd ?? "—"}
                    </td>
                    <td className="tnum hidden h-[42px] px-2 text-right text-[13px] md:table-cell">
                      {positives > 0 ? (
                        <span className="text-positive">+{positives}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {neutrals > 0 ? (
                        <span className="text-[11px] text-muted-foreground"> / {neutrals}</span>
                      ) : null}
                    </td>
                    <td className="tnum hidden h-[42px] px-2 text-right text-[13px] md:table-cell">
                      {cautions > 0 ? (
                        <span className="text-warning">{cautions}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="h-[42px] px-2">
                      {top === null ? (
                        <span className="text-xs text-muted-foreground">
                          Belum ada metrik untuk aturan mana pun
                        </span>
                      ) : (
                        <span className="flex max-w-[440px] items-center gap-2 text-xs">
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[top.tone]}`}
                            aria-hidden="true"
                          />
                          <span className="truncate" title={top.text}>
                            {top.text}
                          </span>
                          {insights.length > 1 ? (
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              +{insights.length - 1}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-[11px] leading-4 text-muted-foreground">
        Wawasan dihitung oleh aturan tetap yang sama untuk semua perusahaan (tiap kartu di halaman
        detail memuat rule id-nya). Metrik yang hilang tidak dipalsukan — tanda &quot;—&quot; berarti
        tanpa data; skor hanya muncul ketika minimal 2 metrik tersedia.
      </p>
    </>
  );
}
