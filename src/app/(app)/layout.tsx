import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";

export const metadata = {
  title: "StockLens",
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <Sidebar />
      <main className="md:pl-64">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
}
