import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client untuk komponen browser. Melempar error yang enak dibaca
 * (bukan crash samar) ketika penyiapan belum selesai.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase belum dikonfigurasi — isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di file .env. Lihat README bagian Penyiapan.",
    );
  }
  return createBrowserClient(url, anonKey);
}
