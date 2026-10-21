import { FileUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/states/empty-state";

export const metadata = {
  title: "Data Import",
};

const PRICE_FORMAT = "date, ticker, open, high, low, close, volume";
const FUNDAMENTAL_FORMAT =
  "ticker, period_end, revenue, net_income, total_assets, total_liabilities, total_equity, operating_cash_flow, capex, eps";

export default function ImportPage() {
  return (
    <>
      <PageHeader
        title="Data Import"
        subtitle="Jalur utama memasukkan data pasar — CSV yang Anda miliki"
      />
      <EmptyState
        icon={FileUp}
        title="CSV import wizard menunggu implementasi"
        description="Unggah CSV, preview, mapping kolom, pilih format tanggal & mata uang, validasi baris (duplikat, nilai kosong, format tidak valid), konfirmasi, lalu atur dataset dari riwayat impor."
        phase="Fase 3 — Demo Data & CSV Import"
      />
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Format minimum yang didukung</CardTitle>
          <CardDescription>
            Tidak semua kolom wajib — aplikasi menunjukkan metrik mana yang bisa dihitung dari
            kolom yang tersedia.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Harga saham</p>
            <code className="tnum block overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs">
              {PRICE_FORMAT}
            </code>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Data fundamental</p>
            <code className="tnum block overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs">
              {FUNDAMENTAL_FORMAT}
            </code>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
