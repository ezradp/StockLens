// SERVER-ONLY: file ini memakai SUPABASE_SERVICE_ROLE_KEY (secret).
// Jangan pernah diimpor dari komponen client.
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client server dengan JWT pengguna dari cookies.
 * Seluruh query melalui client ini dipindahkan oleh RLS di database.
 */
export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase belum dikonfigurasi — isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di file .env. Lihat README bagian Penyiapan.",
    );
  }
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Cookies tidak bisa ditulis dari Server Component; refresh token
          // akan ditangani middleware (Fase 2).
        }
      },
    },
  });
}

/** Client service role (server-only, bypass RLS) untuk seed/admin. */
export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY belum diisi di .env (server-only; nilainya tidak boleh dikirim ke client).",
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
