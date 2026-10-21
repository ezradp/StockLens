import Link from "next/link";
import { Database } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { SetupRequired } from "@/components/setup-required";
import { getEnvStatus } from "@/lib/env";

export const metadata = {
  title: "Overview",
};

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

export default function OverviewPage() {
  const status = getEnvStatus();

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Ringkasan portofolio, watchlist, dan insights terbaru"
      />

      {!status.supabaseConfigured ? (
        <SetupRequired
          steps={SETUP_STEPS}
          note="Aplikasi tetap aman tanpa kredensial: halaman-halaman data menampilkan state penyiapan sampai database terhubung."
        />
      ) : (
        <EmptyState
          icon={Database}
          title="Dashboard akan hidup begitu data tersedia"
          description="Panel di halaman ini akan menampilkan total portfolio value, unrealized/realized P/L, alokasi, watchlist, transaksi terakhir, ringkasan pasar, dan insights — semuanya dihitung dari data yang benar-benar tersimpan (tanpa data pasar palsu)."
          phase="Fase 3 → 7"
        />
      )}

      {status.supabaseConfigured ? (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Sementara itu, jalur data bisa disiapkan di menu{" "}
          <Link href="/import" className="text-primary underline-offset-4 hover:underline">
            Data Import
          </Link>
          .
        </p>
      ) : null}
    </>
  );
}
