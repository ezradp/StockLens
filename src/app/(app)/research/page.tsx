import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";

export const metadata = {
  title: "Saved Research",
};

export default function ResearchPage() {
  return (
    <>
      <PageHeader
        title="Saved Research"
        subtitle="Catatan riset, scenario DCF, saved screens, dan insight tersimpan"
      />
      <EmptyState
        icon={BookOpen}
        title="Saved research menunggu implementasi"
        description="Simpan riset notes per perusahaan, hasil perbandingan, DCF scenarios, saved screens, dan insight relevan — semuanya milik Anda, tersimpan di database dengan timestamps, dapat diperbarui atau dihapus."
        phase="Fase 8 — Insights & Saved Research"
      />
    </>
  );
}
