"use server";

import { revalidatePath } from "next/cache";
import {
  saveValuationScenario,
  deleteValuationScenario,
} from "@/server/dcf";

export async function saveValuationScenarioAction(
  companyId: string,
  name: string,
  assumptions: Record<string, number | string | null>,
  results: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const result = await saveValuationScenario(companyId, name, assumptions, results);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/valuation");
  return { ok: true };
}

export async function deleteValuationScenarioAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await deleteValuationScenario(id);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/valuation");
  return { ok: true };
}
