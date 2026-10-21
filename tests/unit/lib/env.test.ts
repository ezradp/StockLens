import { describe, expect, it } from "vitest";
import { serverEnvSchema, validateServerEnv } from "@/lib/env";

const FULL_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  DATABASE_URL: "postgres://postgres:postgres@localhost:5432/stocklens",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  PRICE_PROVIDER: "tiingo",
  PRICE_PROVIDER_API_KEY: "tk",
};

describe("serverEnvSchema", () => {
  it("menerima environment lengkap yang valid", () => {
    const result = validateServerEnv(FULL_ENV);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.env.NEXT_PUBLIC_SUPABASE_URL).toContain("supabase.co");
  });

  it("menerima environment minimal (seed example) tanpa kredensial", () => {
    const result = validateServerEnv({});
    expect(result.ok).toBe(true);
  });

  it("menolak KEY yang tidak dikenal", () => {
    const result = validateServerEnv({
      ...FULL_ENV,
      PRICE_PROVIDER: "yahoo",
    });
    expect(result.ok).toBe(false);
  });

  it("menolak URL Supabase tanpa skema https", () => {
    const result = validateServerEnv({
      ...FULL_ENV,
      NEXT_PUBLIC_SUPABASE_URL: "example.supabase.co",
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBeTruthy();
  });

  it("menolak key kosong", () => {
    const result = validateServerEnv({
      ...FULL_ENV,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    });
    expect(result.ok).toBe(false);
  });

  it("skema zod langsung juga dapat dipakai (bukan fungsi sarap)", () => {
    const parsed = serverEnvSchema.parse(FULL_ENV);
    expect(parsed.PRICE_PROVIDER).toBe("tiingo");
  });
});
