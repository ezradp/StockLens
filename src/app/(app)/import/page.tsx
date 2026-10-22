import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SetupRequired } from "@/components/setup-required";
import { getEnvStatus } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ImportWizard, type CompanyOption } from "./import-wizard";

export const metadata = {
  title: "Data Import",
};

export const instant = false; // membaca sesi & daftar perusahaan — blokir shell statis

const SETUP_STEPS = [
  {
    title: "Buat project Supabase (free tier)",
    description: "Di supabase.com buat project, catat Project URL, anon key, service role key, dan connection string.",
  },
  {
    title: "Isi file .env",
    description: 'Salin .env.example menjadi .env lalu isi kredensial Supabase (lihat card "Environment" di Settings).',
  },
  {
    title: "Jalankan migrasi + seed",
    description: "npm run db:migrate membuat tabel; npm run db:seed mengisi master perusahaan dari SEC EDGAR (gratis).",
  },
];

export default async function ImportPage() {
  const status = getEnvStatus();

  if (!status.supabaseConfigured) {
    return (
      <>
        <PageHeader
          title="Data Import"
          subtitle="Jalur utama memasukkan data pasar — CSV yang Anda miliki"
        />
        <SetupRequired
          steps={SETUP_STEPS}
          note="Tanpa database terhubung wizard tetap tidak bisa menulis; ikuti langkah di atas untuk mengaktifkannya."
        />
      </>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("companies").select("ticker, name").order("ticker");
  const companies: CompanyOption[] = (data ?? []).map((company) => ({
    ticker: company.ticker,
    name: company.name,
  }));

  return (
    <>
      <PageHeader
        title="Data Import"
        subtitle="Jalur utama memasukkan data pasar — CSV milik Anda, divalidasi baris per baris"
      />

      <ImportWizard companies={companies} />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Aturan main</CardTitle>
          <CardDescription>Transparansi suplai data &amp; kuota free tier</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>
            Harga yang diimpor ditulis dengan <code>source_type=&apos;import&apos;</code> dan
            menimpa baris tanggal sama untuk perusahaan yang dipilih (unique
            <code> company_id + date</code>). Penulisan data pasar hanya dilakukan server; hak Anda
            tercatat via riwayat <code>import_batches</code> milik user (RLS).
          </p>
          <p>
            Fondamen ditulis per kelompok (statement_type + period_end) menimpa kelompok tanggal yang
            sama — baris &apos;seed&apos; dan &apos;provider&apos; tidak tertimpa oleh wizard, gunakan
            <code> npm run db:seed</code> untuk memperbarui seed.
          </p>
          <p>File lebih dari 100.000 baris dibatasi demi kuota free tier — potong per kebutuhan.</p>
        </CardContent>
      </Card>
    </>
  );
}
