import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Sidebar } from "@/components/layout/sidebar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEnvStatus } from "@/lib/env";

export const metadata = {
  title: "StockLens",
};

/**
 * Seluruh grup (app) berada di balik sesi login — shell-nya per request,
 * bukan shell statis. Nonaktifkan validasi instant prerender (Next 16
 * Cache Components) agar akses cookies untuk guard sesi sah di build.
 */
export const instant = false;

/** Seluruh route di bawah (app) menuntut sesi login valid (defence-in-depth selain proxy). */
export default async function AppLayout({ children }: { children: ReactNode }) {
  // Tandai request-time secara eksplisit: shell membaca sesi (cookies) dan tidak
  // boleh dicoba diprerender.
  await connection();

  const envStatus = getEnvStatus();
  let email: string | null = null;

  if (envStatus.supabaseConfigured) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) redirect("/login");
    email = data.user.email ?? null;
  }

  return (
    <div className="min-h-dvh">
      <Sidebar email={email} />
      <main className="md:pl-[var(--sidebar-width)]">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
