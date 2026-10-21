import { CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEnvStatus } from "@/lib/env";

export const metadata = {
  title: "Settings",
};

const status = getEnvStatus();

const CONFIG_ITEMS = [
  {
    label: "Supabase (URL & anon key)",
    envVars: "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ok: status.supabaseConfigured,
    required: true,
    note: "Bukan secret — aman tampil di client.",
  },
  {
    label: "Service role key (server-only)",
    envVars: "SUPABASE_SERVICE_ROLE_KEY",
    ok: status.serviceRoleConfigured,
    required: true,
    note: "Secret. Dipakai hanya di server (seed/admin), tidak pernah masuk client bundle.",
  },
  {
    label: "Database connection",
    envVars: "DATABASE_URL",
    ok: status.databaseConfigured,
    required: true,
    note: "Dipakai migration runner & operasi SQL langsung.",
  },
  {
    label: "Provider harga historis (opsional)",
    envVars: "PRICE_PROVIDER, PRICE_PROVIDER_API_KEY",
    ok: status.priceProviderConfigured,
    required: false,
    note: "Free key Tiingo/Twelve Data untuk seed harga — kuota & lisensi didokumentasikan di README.",
  },
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Status konfigurasi environment dan preferensi aplikasi"
      />

      <Card>
        <CardHeader>
          <CardTitle>Environment</CardTitle>
          <CardDescription>
            Status di bawah mencerminkan isi file .env saat aplikasi dijalankan (server-side,
            tanpa membocorkan nilainya).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {CONFIG_ITEMS.map((item) => (
            <div
              key={item.envVars}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-background/60 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {item.label}{" "}
                  {item.required ? null : <Badge variant="secondary">opsional</Badge>}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{item.envVars}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
              </div>
              {item.ok ? (
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
          ))}
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
