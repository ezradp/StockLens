import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Integration test isolasi kepemilikan (RLS) — PRD §8.
 * Berjalan otomatis saat kredensial Supabase tersedia (dibaca dari .env);
 * test users dibuat khusus, diisi data, lalu DIHAPUS di afterAll.
 */

function loadEnvFile() {
  try {
    const raw = readFileSync(join(process.cwd(), ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // .env tidak ada — test akan skip
  }
}
loadEnvFile();

const URL = process.env.TEST_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.TEST_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.TEST_SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const RUN = Boolean(URL && ANON && SERVICE);

const PASSWORD = "StockLens-Test-2026!";

describe.skipIf(!RUN)("RLS isolasi kepemilikan antar user (Supabase)", () => {
  const admin = createClient(URL!, SERVICE!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const stamp = Date.now();
  const emailA = `stocklens-user-a-${stamp}@stocklens.test`;
  const emailB = `stocklens-user-b-${stamp}@stocklens.test`;
  let idA = "";
  let idB = "";

  beforeAll(async () => {
    const resA = await admin.auth.admin.createUser({
      email: emailA,
      password: PASSWORD,
      email_confirm: true,
    });
    const resB = await admin.auth.admin.createUser({
      email: emailB,
      password: PASSWORD,
      email_confirm: true,
    });
    const userA = resA.data?.user;
    const userB = resB.data?.user;
    if (!userA || !userB) throw new Error("Gagal membuat test users (payload admin).");
    idA = userA.id;
    idB = userB.id;
  });

  async function asUser(email: string): Promise<SupabaseClient> {
    const client = createClient(URL!, ANON!);
    const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    expect(error).toBeNull();
    return client;
  }

  it("user hanya melihat watchlist miliknya dan tidak bisa mengubah milik user lain", async () => {
    const clientA = await asUser(emailA);
    const clientB = await asUser(emailB);

    const { error: errA } = await clientA
      .from("watchlists")
      .insert({ name: "A-List" })
      .select()
      .single();
    const { data: createdB, error: errB } = await clientB
      .from("watchlists")
      .insert({ name: "B-List" })
      .select()
      .single();
    expect(errA).toBeNull();
    expect(errB).toBeNull();

    // profiles dibuat otomatis oleh trigger (0006)
    const { data: profileA } = await clientA.from("profiles").select("id").eq("id", idA).single();
    expect(profileA?.id).toBe(idA);

    // A hanya melihat milik A
    const { data: listA, error: errList } = await clientA.from("watchlists").select();
    expect(errList).toBeNull();
    expect(listA?.every((row) => row.user_id === idA)).toBe(true);
    expect(listA?.some((row) => row.id === createdB!.id)).toBe(false);

    // A tidak bisa mengubah/menghapus milik B (RLS menyaring, bukan error keras)
    const { data: hijack, error: errHijack } = await clientA
      .from("watchlists")
      .update({ name: "HACKED" })
      .eq("id", createdB!.id)
      .select();
    expect(errHijack).toBeNull();
    expect(hijack?.length ?? 0).toBe(0);

    const { data: deletedForeign, error: errDel } = await clientA
      .from("watchlists")
      .delete()
      .eq("id", createdB!.id)
      .select();
    expect(errDel).toBeNull();
    expect(deletedForeign?.length ?? 0).toBe(0);
  });

  it("anon key tanpa JWT tidak melihat apa pun dari tabel personal", async () => {
    const anonClient = createClient(URL!, ANON!);
    const { data, error } = await anonClient.from("watchlists").select();
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0);
  });

  afterAll(async () => {
    if (!idA && !idB) return;
    try {
      await admin.from("watchlists").delete().in("user_id", [idA, idB].filter(Boolean));
      if (idA) await admin.auth.admin.deleteUser(idA);
      if (idB) await admin.auth.admin.deleteUser(idB);
    } catch {
      // cleanup bersifat best-effort
    }
  });
});
