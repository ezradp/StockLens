import { PageHeader } from "@/components/layout/page-header";
import { SetupRequired } from "@/components/setup-required";
import { getEnvStatus } from "@/lib/env";
import { listNotes } from "@/server/notes";
import { listCompanySummaries } from "@/server/companies";
import { ResearchView } from "./research-view";

export const metadata = {
  title: "Saved Research",
};

export const instant = false;

interface CompanyOption {
  id: string;
  ticker: string;
  name: string;
}

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

export default async function ResearchPage() {
  const status = getEnvStatus();

  if (!status.supabaseConfigured) {
    return (
      <>
        <PageHeader
          title="Saved Research"
          subtitle="Catatan riset, scenario DCF, saved screens, dan insight tersimpan"
        />
        <SetupRequired
          steps={SETUP_STEPS}
          note="Tabel research_notes + RLS milik-sendiri sudah siap di migrasi — tidak ada data demo."
        />
      </>
    );
  }

  const [notes, companies] = await Promise.all([listNotes(), listCompanySummaries()]);

  const companyOptions: CompanyOption[] = companies.map((company) => ({
    id: company.id,
    ticker: company.ticker,
    name: company.name,
  }));

  return (
    <>
      <PageHeader
        title="Saved Research"
        subtitle="Catatan riset milik Anda; tautan opsional ke perusahaan"
      />
      <ResearchView notes={notes} companyOptions={companyOptions} />
    </>
  );
}
