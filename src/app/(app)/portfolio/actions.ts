"use server";

import { revalidatePath } from "next/cache";
import {
  createPortfolio,
  deletePortfolio,
  addTransaction,
  deleteTransaction,
  validateTransaction,
} from "@/server/portfolio";

export async function createPortfolioAction(
  name: string,
  baseCurrency = "USD",
): Promise<{ ok: boolean; error?: string }> {
  const result = await createPortfolio(name, baseCurrency);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/portfolio");
  return { ok: true };
}

export async function deletePortfolioAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await deletePortfolio(id);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/portfolio");
  return { ok: true };
}

export async function addTransactionAction(
  portfolioId: string,
  raw: {
    transactionType: string;
    transactionDate: string;
    companyId: string | null;
    quantity: string | null;
    price: string | null;
    amount: string | null;
    fees: string | null;
  },
  currency = "USD",
  notes?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const validated = validateTransaction(raw);
  if (!validated.ok) return { ok: false, error: validated.error };
  const result = await addTransaction(portfolioId, validated.value, currency, notes);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/portfolio");
  return { ok: true };
}

export async function deleteTransactionAction(
  portfolioId: string,
  transactionId: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await deleteTransaction(portfolioId, transactionId);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/portfolio");
  return { ok: true };
}
