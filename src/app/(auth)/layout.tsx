import type { ReactNode } from "react";
import { Brand, LensMark } from "@/components/layout/brand";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh md:grid-cols-[1.05fr_1fr]">
      <div className="hidden flex-col justify-between border-r border-border p-10 md:flex">
        <Brand />
        <div>
          <p className="max-w-[440px] text-[26px] font-semibold leading-9 tracking-[-0.02em]">
            Angka dulu, dekorasi belakangan.
          </p>
          <p className="mt-3 max-w-[380px] text-[13px] leading-5 text-muted-foreground">
            Laporan keuangan SEC EDGAR, harga penutupan harian, dan aturan wawasan yang bisa
            dibaca di kode — bukan kotak hitam.
          </p>
        </div>
        <p className="tnum text-[11px] text-muted-foreground">
          SEC EDGAR · Harga EOD · Tanpa data demo
        </p>
      </div>

      <div className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[360px]">
          <div className="mb-8 flex items-center gap-2.5 md:hidden">
            <LensMark className="h-5 w-5 text-accent" />
            <span className="text-[15px] font-semibold tracking-[-0.01em]">StockLens</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
