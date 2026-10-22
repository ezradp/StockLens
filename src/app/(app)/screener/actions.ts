"use server";

import { revalidatePath } from "next/cache";
import type { ScreenFilters } from "@/engine/screener";
import { saveScreen, deleteScreen, validateScreenName } from "@/server/saved-screens";

export async function saveScreenAction(
  name: string,
  filters: ScreenFilters,
): Promise<{ ok: boolean; error?: string }> {
  const validationError = validateScreenName(name);
  if (validationError) return { ok: false, error: validationError };

  const result = await saveScreen(name, filters);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/screener");
  return { ok: true };
}

export async function deleteScreenAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await deleteScreen(id);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/screener");
  return { ok: true };
}
