import { Calculator } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";

export const metadata = {
  title: "DCF Valuation",
};

export default function ValuationPage() {
  return (
    <>
      <PageHeader
        title="DCF Valuation"
        subtitle="Estimasi nilai intrinsik dengan kalkulasi internal — tanpa API eksternal"
      />
      <EmptyState
        icon={Calculator}
        title="DCF engine menunggu implementasi"
        description="Forecast FCF, present value, terminal value, enterprise & equity value, intrinsic value per share, margin of safety, sensitivity analysis, dan scenario comparison — lengkap dengan validasi (WACC wajib lebih besar dari terminal growth) dan bisa dijalankan dengan input manual."
        phase="Fase 6 — DCF Engine"
      />
    </>
  );
}
