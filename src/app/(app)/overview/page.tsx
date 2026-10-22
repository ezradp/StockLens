import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { SetupRequired } from "@/components/setup-required";
import { Card, CardContent } from "@/components/ui/card";
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
  positive: "bg-green-500",
  neutral: "bg-slate-400",
  caution: "bg-amber-500",
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
          <Link href="/import" className="text-primary underline-offset-4 hover:underline">
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
        ].map((card) => (
          <Card key={card.label}>
            <CardContent>
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="tnum mt-1 text-lg font-semibold">{card.value}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{card.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th scope="col" className="px-2 py-2 font-medium">Ticker</th>
                <th scope="col" className="px-2 py-2 font-medium">Sektor</th>
                <th scope="col" className="px-2 py-2 font-medium">Skor</th>
                <th scope="col" className="px-2 py-2 font-medium">Laporan</th>
                <th scope="col" className="px-2 py-2 font-medium">Pos</th>
                <th scope="col" className="px-2 py-2 font-medium">Was</th>
                <th scope="col" className="px-2 py-2 font-medium">Wawasan teratas</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(({ row, insights, top }) => {
                const positives = insights.filter((i) => i.tone === "positive").length;
                const cautions = insights.filter((i) => i.tone === "caution").length;
                const neutrals = insights.filter((i) => i.tone === "neutral").length;
                return (
                  <tr key={row.ticker} className="border-b border-border/40 align-top">
                    <td className="px-2 py-2">
                      <Link
                        href={`/explorer/${row.ticker}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {row.ticker}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{row.name}</span>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{row.sector ?? "—"}</td>
                    <td className="tnum px-2 py-2">
                      {row.score === null ? "—" : formatNumber(row.score, 0)}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{row.latestPeriodEnd ?? "—"}</td>
                    <td className="tnum px-2 py-2">
                      {positives > 0 ? (
                        <span className="text-green-400">+{positives}</span>
                      ) : (
                        "—"
                      )}
                      {neutrals > 0 ? (
                        <span className="ml-1 text-muted-foreground">/ {neutrals}</span>
                      ) : null}
                    </td>
                    <td className="tnum px-2 py-2">
                      {cautions > 0 ? (
                        <span className="text-amber-400">{cautions}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-2 text-xs leading-relaxed">
                      {top === null ? (
                        <span className="text-muted-foreground">
                          Belum ada metrik untuk aturan mana pun
                        </span>
                      ) : (
                        <span className="flex gap-1.5">
                          <span className={TONE_DOT[top.tone]} aria-hidden="true" />
                          <span>{top.text}</span>
                        </span>
                      )}
                      {insights.length > 1 ? (
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          +{insights.length - 1} wawasan lain di detail
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Wawasan dihitung oleh aturan tetap yang sama untuk semua perusahaan (tiap kartu
        di halaman detail memuat rule id-nya). Metrik yang hilang tidak dipalsukan —
        tanda &quot;—&quot; berarti tanpa data; skor hanya muncul ketika minimal 2 metrik tersedia.
      </p>
    </>
  );
}
