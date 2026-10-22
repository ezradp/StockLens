import Link from "next/link";
import { Star } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";

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
        title="Belum ada watchlist"
        description="Fitur watchlist belum aktif di versi ini. Untuk sementara, pantau emiten dan metriknya lewat Stock Explorer."
        action={
          <Link href="/explorer" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Buka Stock Explorer
          </Link>
        }
      />
    </>
  );
}
