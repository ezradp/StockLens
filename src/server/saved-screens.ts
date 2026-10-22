/**
 * Saved screens (Fase 5) — CRUD via USER client (RLS: baris milik sendiri;
 * user_id diisi DEFAULT app.auth_uid()). filters_json memuat rasio, bukan persen.
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeFilters, type ScreenFilters } from "@/engine/screener";

const MAX_SAVED_SCREENS = 24;
const MAX_NAME_LENGTH = 80;

export interface SavedScreen {
  id: string;
  name: string;
  filters: ScreenFilters;
  createdAt: string;
}

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function listSavedScreens(): Promise<SavedScreen[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("saved_screens")
    .select("id, name, filters_json, created_at")
    .order("created_at", { ascending: false })
    .limit(MAX_SAVED_SCREENS);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    filters: sanitizeFilters(row.filters_json),
    createdAt: row.created_at,
  }));
}

export function validateScreenName(raw: string): string | null {
  const name = raw.trim();
  if (name.length === 0) return "Nama layar tidak boleh kosong.";
  if (name.length > MAX_NAME_LENGTH) return `Nama layar maks ${MAX_NAME_LENGTH} karakter.`;
  return null;
}

export async function saveScreen(
  name: string,
  filters: ScreenFilters,
): Promise<ActionResult<SavedScreen>> {
  const validationError = validateScreenName(name);
  if (validationError) return { ok: false, error: validationError };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("saved_screens")
    .insert({ name: name.trim(), filters_json: filters })
    .select("id, name, filters_json, created_at")
    .single();

  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: {
      id: data.id,
      name: data.name,
      filters: sanitizeFilters(data.filters_json),
      createdAt: data.created_at,
    },
  };
}

export async function deleteScreen(id: string): Promise<ActionResult<null>> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return { ok: false, error: "ID layar tidak valid." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("saved_screens").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}
