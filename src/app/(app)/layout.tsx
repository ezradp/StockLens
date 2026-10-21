import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/(auth)/actions";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
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
      <Sidebar />
      <main className="md:pl-64">
        {email ? (
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-end gap-3 px-4 pt-4 md:px-8">
            <span className="text-xs text-muted-foreground">{email}</span>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Keluar
              </Button>
            </form>
          </div>
        ) : null}
        <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
}
