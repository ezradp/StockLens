"use server";

import { revalidatePath } from "next/cache";
import { createNote, updateNote, deleteNote } from "@/server/notes";

export async function createNoteAction(
  title: string,
  content: string,
  companyId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const result = await createNote(title, content, companyId);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/research");
  return { ok: true };
}

export async function updateNoteAction(
  id: string,
  title: string,
  content: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await updateNote(id, title, content);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/research");
  return { ok: true };
}

export async function deleteNoteAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await deleteNote(id);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/research");
  return { ok: true };
}
