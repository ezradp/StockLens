import { Star } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";

export const metadata = {
  title: "Watchlists",
};

export default function WatchlistsPage() {
  return (
    <>
      <PageHeader
        title="Watchlists"
        subtitle="Daftar pantauan pribadi, tersimpan permanen di database"
      />
      <EmptyState
        icon={Star}
        title="Watchlists menunggu data tersimpan"
        description="Beberapa watchlist per pengguna, catatan pribadi, harga terakhir yang tersedia (dengan sumber & timestamp), pengurutan, dan pintasan ke halaman detail perusahaan."
        phase="Fase 2 (CRUD) & Fase 4 (data harga)"
      />
    </>
  );
}
