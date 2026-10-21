import { z } from "zod";

/**
 * Kontrak environment StockLens.
 * — Var NEXT_PUBLIC_* boleh tampil di client (URL/anon key Supabase bukan secret).
 * — DATABASE_URL dan SUPABASE_SERVICE_ROLE_KEY adalah server-only; nilainya jangan
 *   pernah diakses dari komponen client (PRD §7: secret tidak masuk client bundle).
 * — Validasi tetap longgar saat BUILD, ketat saat DATA LAYER dipakai — supaya app
 *   tetap punya first-run experience yang jelas sebelum Supabase disiapkan.
 */
export const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .refine((v) => v === undefined || /^https?:\/\//.test(v), {
      message: "NEXT_PUBLIC_SUPABASE_URL harus URL lengkap (https://...)",
    })
    .optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  PRICE_PROVIDER: z.enum(["tiingo", "twelvedata", "none"]).optional(),
  PRICE_PROVIDER_API_KEY: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function formatEnvIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(env)"}: ${issue.message}`)
    .join("; ");
}

/** Parse env apa pun (design testable — jangan langsung baca process.env). */
export function validateServerEnv(
  source: Record<string, string | undefined>,
): { ok: true; env: ServerEnv } | { ok: false; error: string } {
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    return { ok: false, error: formatEnvIssues(parsed.error) };
  }
  return { ok: true, env: parsed.data };
}

/**
 * Status keberadaan env — dipakai UI untuk menggambarkan langkah penyiapan
 * secara jujur (tidak pernah berpura-pura data ada).
 */
export interface EnvStatus {
  supabaseConfigured: boolean;
  serviceRoleConfigured: boolean;
  databaseConfigured: boolean;
  priceProviderConfigured: boolean;
}

export function getEnvStatus(): EnvStatus {
  const e = process.env;
  return {
    supabaseConfigured: Boolean(e.NEXT_PUBLIC_SUPABASE_URL && e.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRoleConfigured: Boolean(e.SUPABASE_SERVICE_ROLE_KEY),
    databaseConfigured: Boolean(e.DATABASE_URL),
    priceProviderConfigured: Boolean(
      e.PRICE_PROVIDER_API_KEY && e.PRICE_PROVIDER && e.PRICE_PROVIDER !== "none",
    ),
  };
}

export interface RequiredEnvResult {
  ok: boolean;
  missing: string[];
}

/** Validasi variabel wajib untuk Supabase server client — lemparkan pesan aksi. */
export function assertSupabaseEnv(): RequiredEnvResult {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return { ok: missing.length === 0, missing };
}
