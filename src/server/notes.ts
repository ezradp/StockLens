/**
 * Research notes (Fase 8) — CRUD via USER client (RLS: research_notes_all_own;
 * user_id diisi DEFAULT app.auth_uid()). updated_at dipicu trigger DB.
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_NOTES = 200;
const MAX_TITLE_LENGTH = 120;
const MAX_CONTENT_LENGTH = 8_000;

export interface ResearchNote {
  id: string;
  title: string;
  content: string;
  companyId: string | null;
  ticker: string | null;
  companyName: string | null;
  createdAt: string;
  updatedAt: string;
}

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function listNotes(): Promise<ResearchNote[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("research_notes")
    .select("id, title, content, company_id, created_at, updated_at, companies(ticker, name)")
    .order("updated_at", { ascending: false })
    .limit(MAX_NOTES);

  return (data ?? []).map((row) => {
    // Relasi embedded tanpa Database types: bentuk array ATAU object — tangani keduanya.
    const embedded = row.companies as
      | { ticker?: string; name?: string }
      | { ticker?: string; name?: string }[]
      | null;
    const company = Array.isArray(embedded) ? embedded[0] : embedded;
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      companyId: row.company_id,
      ticker: company?.ticker ?? null,
      companyName: company?.name ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

export function validateNote(
  title: string,
  content: string,
): { ok: true; title: string; content: string } | { ok: false; error: string } {
  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  if (trimmedTitle.length === 0) return { ok: false, error: "Judul catatan tidak boleh kosong." };
  if (trimmedTitle.length > MAX_TITLE_LENGTH) {
    return { ok: false, error: `Judul maks ${MAX_TITLE_LENGTH} karakter.` };
  }
  if (trimmedContent.length > MAX_CONTENT_LENGTH) {
    return { ok: false, error: `Isi maks ${MAX_CONTENT_LENGTH.toLocaleString("id-ID")} karakter (kini ${trimmedContent.length.toLocaleString("id-ID")}).` };
  }
  return { ok: true, title: trimmedTitle, content: trimmedContent };
}

async function resolveCompanyId(
  companyId: string | null,
): Promise<{ ok: true; value: string | null } | { ok: false; error: string }> {
  if (companyId === null || companyId === "") return { ok: true, value: null };
  if (!/^[0-9a-f-]{36}$/i.test(companyId)) {
    return { ok: false, error: "ID perusahaan tidak valid." };
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .maybeSingle();
  if (!data) return { ok: false, error: "Perusahaan tidak ditemukan." };
  return { ok: true, value: companyId };
}

export async function createNote(
  title: string,
  content: string,
  companyId: string | null = null,
): Promise<ActionResult<ResearchNote>> {
  const validated = validateNote(title, content);
  if (!validated.ok) return { ok: false, error: validated.error };
  const company = await resolveCompanyId(companyId);
  if (!company.ok) return { ok: false, error: company.error };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("research_notes")
    .insert({ title: validated.title, content: validated.content, company_id: company.value })
    .select("id, title, content, company_id, created_at, updated_at, companies(ticker, name)")
    .single();
  if (error) return { ok: false, error: error.message };

  const embedded = data.companies as { ticker?: string; name?: string } | null;
  return {
    ok: true,
    data: {
      id: data.id,
      title: data.title,
      content: data.content,
      companyId: data.company_id,
      ticker: embedded?.ticker ?? null,
      companyName: embedded?.name ?? null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  };
}

export async function updateNote(
  id: string,
  title: string,
  content: string,
): Promise<ActionResult<null>> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "ID catatan tidak valid." };
  const validated = validateNote(title, content);
  if (!validated.ok) return { ok: false, error: validated.error };

  const supabase = await createSupabaseServerClient();
  // RLS memastikan hanya baris milik sendiri yang terupdate.
  const { data, error } = await supabase
    .from("research_notes")
    .update({ title: validated.title, content: validated.content })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Catatan tidak ditemukan (bukan milik Anda atau sudah dihapus)." };
  return { ok: true, data: null };
}

export async function deleteNote(id: string): Promise<ActionResult<null>> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "ID catatan tidak valid." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("research_notes")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Catatan tidak ditemukan (bukan milik Anda atau sudah dihapus)." };
  return { ok: true, data: null };
}
