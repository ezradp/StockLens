import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Integration test choreography CSV import — menegakkan aturan keamanan PRD:
 *  - import_batches milik user (RLS insert own + default user_id),
 *  - authenticated TIDAK boleh INSERT market_prices langsung (server/service saja),
 *  - halaman import menulis via service client sambil tercatat import_batch_id,
 *  - cleanup penuh: baris pasar + batch + user test dihapus.
 */

function loadEnvFile(): void {
  try {
    const raw = readFileSync(join(process.cwd(), ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // .env tidak ada — test skip
  }
}
loadEnvFile();

const URL = process.env.TEST_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.TEST_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.TEST_SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const RUN = Boolean(URL && ANON && SERVICE);

const PASSWORD = "StockLens-Test-2026!";

describe.skipIf(!RUN)("CSV import choreography (Supabase)", () => {
  const admin = createClient(URL!, SERVICE!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const stamp = Date.now();
  const email = `stocklens-import-${stamp}@stocklens.test`;
  const ticker = `SLT${String(stamp).slice(-6)}`;
  let userId = "";
  let companyId = "";
  let batchId = "";
  let userClient: SupabaseClient | null = null;

  beforeAll(async () => {
    const created = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    });
    const user = created.data?.user;
    if (!user) throw new Error("Gagal membuat test user");
    userId = user.id;

    const company = await admin
      .from("companies")
      .insert({ ticker, name: `TestCo ${ticker}`, currency: "USD" })
      .select("id")
      .single();
    if (company.error || !company.data) throw new Error(`Gagal membuat company test: ${company.error?.message}`);
    companyId = company.data.id as unknown as string;

    userClient = createClient(URL!, ANON!);
    const signIn = await userClient.auth.signInWithPassword({ email, password: PASSWORD });
    if (signIn.error) throw new Error(`Login test gagal: ${signIn.error.message}`);
  });

  it("user memiliki batch impor, dan market_prices valid ditulis via server", async () => {
    // 1) Batch disisipkan oleh USER (RLS own) — user_id default app.auth_uid().
    const batch = await userClient!
      .from("import_batches")
      .insert({ file_name: "import-test.csv", data_type: "prices", rows_imported: 0, rows_rejected: 0, status: "processing" })
      .select("id, user_id")
      .single();
    expect(batch.error).toBeNull();
    expect(batch.data?.user_id).toBe(userId);
    batchId = batch.data!.id;

    // 2) User TIDAK boleh menulis market_prices langsung — policy INSERT tidak ada.
    const fakeRow = {
      company_id: companyId,
      date: "2099-01-01",
      open: 10,
      high: 11,
      low: 9,
      close: 10.5,
      volume: 100,
      source_type: "manual",
      source_name: "",
      import_batch_id: batchId,
    };
    const direct = await userClient!.from("market_prices").insert(fakeRow).select();
    // PostgREST menolak dengan error RLS policy (pesan tidak kosong)
    expect(direct.error).not.toBeNull();

    // 3) Server/service yang menulis — baris tercatat atas batch milik user.
    const service = admin;
    const upserted = await service
      .from("market_prices")
      .upsert({ ...fakeRow, source_type: "import", source_name: "import-test.csv" }, { onConflict: "company_id,date" })
      .select("id")
      .single();
    expect(upserted.error).toBeNull();

    // 4) User MENIADAKAN row-nya (market_prices dibaca bersama oleh authenticated)
    const visible = await userClient!
      .from("market_prices")
      .select("id, source_name")
      .eq("id", upserted.data!.id)
      .maybeSingle();
    expect(visible.error).toBeNull();
    expect(visible.data?.source_name).toBe("import-test.csv");

    // 5) User menandai batch selesai (UPDATE own) + jumlah baris diisi.
    const finalize = await userClient!
      .from("import_batches")
      .update({ status: "completed", rows_imported: 1 })
      .eq("id", batchId)
      .select("status")
      .single();
    expect(finalize.error).toBeNull();
    expect(finalize.data?.status).toBe("completed");

    // 6) User menghapus batch miliknya (DELETE own) — masih memungkinkan.
    const remove = await userClient!.from("import_batches").delete().eq("id", batchId).select();
    expect(remove.error).toBeNull();
    batchId = ""; // terhapus semua
  });

  afterAll(async () => {
    try {
      if (companyId) await admin.from("market_prices").delete().eq("company_id", companyId);
      if (companyId) await admin.from("companies").delete().eq("id", companyId);
      if (batchId) await admin.from("import_batches").delete().eq("id", batchId);
      if (userId) await admin.auth.admin.deleteUser(userId);
    } catch {
      // cleanup best-effort
    }
  });
});
