import { CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SetupRequired } from "@/components/setup-required";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEnvStatus } from "@/lib/env";

export const metadata = {
  title: "Settings",
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

const CONFIG_ITEMS = [
  {
    label: "Supabase (URL & anon key)",
    envVars: "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
    note: "Bukan secret — aman tampil di client.",
    envKey: "supabaseConfigured" as const,
  },
  {
    label: "Service role key (server-only)",
    envVars: "SUPABASE_SERVICE_ROLE_KEY",
    required: true,
    note: "Secret. Dipakai hanya di server (seed/admin), tidak pernah masuk client bundle.",
    envKey: "serviceRoleConfigured" as const,
  },
  {
    label: "Database connection",
    envVars: "DATABASE_URL",
    required: true,
    note: "Dipakai migration runner & operasi SQL langsung.",
    envKey: "databaseConfigured" as const,
  },
  {
    label: "Provider harga historis (opsional)",
    envVars: "PRICE_PROVIDER, PRICE_PROVIDER_API_KEY",
    required: false,
    note: "Free key Tiingo/Twelve Data untuk seed harga — kuota & lisensi didokumentasikan di README.",
    envKey: "priceProviderConfigured" as const,
  },
];

export default async function SettingsPage() {
  const status = getEnvStatus();

  if (!status.supabaseConfigured) {
    return (
      <>
        <PageHeader
          title="Settings"
          subtitle="Status konfigurasi environment dan preferensi aplikasi"
        />
        <SetupRequired
          steps={SETUP_STEPS}
          note="Anda sedang memakai aplikasi tanpa database terhubung — semua fitur data tetap menampilkan status penyiapan secara jujur."
        />
      </>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  let profile: { display_name: string; preferred_currency: string; theme: string } | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, preferred_currency, theme")
      .eq("id", user.id)
      .maybeSingle();
    profile = data ?? null;
  }

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Profil akun, status konfigurasi environment, dan preferensi aplikasi"
      />

      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
          <CardDescription>
            Baris profiles dibuat otomatis saat pendaftaran (trigger migrasi 0006) — akun Anda
            dijaga RLS: hanya pemilik yang bisa membacanya.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {[
            { label: "Email", value: user?.email ?? "—" },
            { label: "Nama tampilan", value: profile?.display_name || "— (kosong)" },
            { label: "Mata uang", value: profile?.preferred_currency ?? "USD" },
            { label: "Tema", value: profile?.theme ?? "dark" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-background/60 px-4 py-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="tnum mt-1 text-sm font-medium">{item.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Environment</CardTitle>
          <CardDescription>
            Status di bawah mencerminkan isi file .env saat aplikasi dijalankan (server-side,
            tanpa membocorkan nilainya).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {CONFIG_ITEMS.map((item) => {
            const ok = status[item.envKey];
            return (
              <div
                key={item.envVars}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-background/60 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {item.label} {item.required ? null : <Badge variant="secondary">opsional</Badge>}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{item.envVars}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
                </div>
                {ok ? (
                  <Badge variant="success">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    Siap
                  </Badge>
                ) : (
                  <Badge variant={item.required ? "danger" : "secondary"}>
                    <XCircle className="h-3 w-3" aria-hidden="true" />
                    {item.required ? "Belum" : "Kosong"}
                  </Badge>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Tampilan</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Mode gelap charcoal adalah default produk. Toggle light mode akan tersedia di
            halaman ini setelah penyiapan tema (Fase 9).
          </p>
        </CardContent>
      </Card>
    </>
  );
}
