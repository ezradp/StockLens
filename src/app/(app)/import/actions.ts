"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildFundamentalImport,
  buildPriceImport,
  type FundamentalImportResult,
  type PriceImportResult,
} from "@/lib/csv/import";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { getEnvStatus } from "@/lib/env";
import type { ImportActionState, ImportPreviewState } from "./import-state";
import type { ImportDataType } from "@/lib/csv/import";

const REJECTION_SAMPLE_LIMIT = 8;
const SAMPLE_LIMIT = 3;
const WRITE_CHUNK = 500;

interface ParsedForm {
  dataType: ImportDataType;
  csv: string;
  ticker: string;
  fileName: string;
}

function parseForm(formData: FormData): ParsedForm | ImportActionState {
  const rawType = String(formData.get("dataType") ?? "");
  const dataType: ImportDataType = rawType === "fundamentals" ? "fundamentals" : "prices";
  const csv = String(formData.get("csv") ?? "");
  const ticker = String(formData.get("ticker") ?? "").trim().toUpperCase();
  const fileName = String(formData.get("fileName") ?? "").trim() || "paste-manual.csv";

  if (csv.trim() === "") {
    return { status: "error", message: "CSV masih kosong — unggah file atau tempel isinya dulu." };
  }
  return { dataType, csv, ticker, fileName };
}

async function requireSession(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function buildPreview(built: PriceImportResult | FundamentalImportResult): ImportPreviewState {
  const isPrices = "rows" in built;
  const missingColumns = isPrices ? (built as PriceImportResult).missingColumns : [];
  const accepted = isPrices ? (built as PriceImportResult).rows.length : (built as FundamentalImportResult).groups.length;
  const rejected = built.rejected.length;
  const duplicates = isPrices
    ? (built as PriceImportResult).duplicateDates
    : (built as FundamentalImportResult).mergedDuplicates;

  const sample: ImportPreviewState["sample"] = isPrices
    ? (built as PriceImportResult).rows.slice(0, SAMPLE_LIMIT).map((row) => [
        { label: "date", value: row.date },
        { label: "open", value: String(row.open) },
        { label: "high", value: String(row.high) },
        { label: "low", value: String(row.low) },
        { label: "close", value: String(row.close) },
        { label: "volume", value: String(row.volume) },
      ])
    : (built as FundamentalImportResult).groups.slice(0, SAMPLE_LIMIT).map((group) => {
        const cells = Object.entries(group.data)
          .slice(0, 5)
          .map(([key, value]) => ({ label: key, value: String(value) }));
        return [
          { label: "statement_type", value: group.statementType },
          { label: "period_end", value: group.periodEnd },
          ...cells,
        ];
      });

  return {
    dataType: isPrices ? "prices" : "fundamentals",
    fileName: "",
    totalRows: built.totalRows,
    accepted,
    rejected,
    duplicates,
    mapping: built.mapping,
    ignoredColumns: built.ignoredColumns,
    missingColumns,
    sample,
    rejectionSamples: rejected > REJECTION_SAMPLE_LIMIT ? built.rejected.slice(0, REJECTION_SAMPLE_LIMIT) : built.rejected,
  };
}

export async function previewImportAction(
  _prev: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  if (!getEnvStatus().supabaseConfigured) {
    return { status: "error", message: "Supabase belum dikonfigurasi — lihat card Environment di Settings." };
  }
  const userId = await requireSession();
  if (!userId) {
    return { status: "error", message: "Sesi berakhir — muat ulang halaman lalu login kembali." };
  }

  const form = parseForm(formData);
  if ("status" in form) return form;

  const built = form.dataType === "prices" ? buildPriceImport(form.csv) : buildFundamentalImport(form.csv);
  const missingColumns = "missingColumns" in built ? built.missingColumns : [];
  const accepted = "rows" in built ? built.rows.length : built.groups.length;

  if (missingColumns.length > 0) {
    return {
      status: "error",
      message: `File tidak memuat kolom wajib: ${missingColumns.join(", ")}. Unduh template di bawah untuk format yang benar.`,
    };
  }
  if (accepted === 0) {
    return {
      status: "error",
      message:
        built.rejected[0]?.reason ??
        "Tidak ada baris valid di file. Pastikan header dan format sesuai template.",
    };
  }

  const preview = buildPreview(built);
  preview.fileName = form.fileName;
  return { status: "preview", message: null, preview };
}

export async function commitImportAction(
  _prev: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  if (String(formData.get("confirm") ?? "") !== "1") {
    return { status: "error", message: "Konfirmasi impor diperlukan — periksa pratinjau terlebih dahulu." };
  }
  if (!getEnvStatus().supabaseConfigured) {
    return { status: "error", message: "Supabase belum dikonfigurasi — lihat card Environment di Settings." };
  }
  const userId = await requireSession();
  if (!userId) {
    return { status: "error", message: "Sesi berakhir — muat ulang halaman lalu login kembali." };
  }

  const form = parseForm(formData);
  if ("status" in form) return form;
  if (!form.ticker) {
    return { status: "error", message: "Pilih terlebih dahulu perusahaan yang datanya diimpor." };
  }

  const built = form.dataType === "prices" ? buildPriceImport(form.csv) : buildFundamentalImport(form.csv);
  const accepted = "rows" in built ? built.rows.length : built.groups.length;
  if (accepted === 0) {
    return { status: "error", message: built.rejected[0]?.reason ?? "Tidak ada baris valid untuk diimpor." };
  }

  const session = await createSupabaseServerClient();

  const { data: company, error: companyError } = await session
    .from("companies")
    .select("id, ticker, name, currency")
    .eq("ticker", form.ticker)
    .maybeSingle();
  if (companyError) {
    return { status: "error", message: `Gagal mencari perusahaan: ${companyError.message}` };
  }
  if (!company) {
    return {
      status: "error",
      message: `Ticker ${form.ticker} belum ada di master perusahaan. Jalankan 'npm run db:seed' atau pilih ticker dari daftar.`,
    };
  }

  // 1) Batch milik USER (RLS insert own; user_id default app.auth_uid()).
  const { data: batch, error: batchError } = await session
    .from("import_batches")
    .insert({
      file_name: form.fileName,
      data_type: form.dataType,
      rows_imported: 0,
      rows_rejected: built.rejected.length,
      status: "processing",
    })
    .select("id")
    .single();
  if (batchError || !batch) {
    return { status: "error", message: `Gagal membuat riwayat impor: ${batchError?.message ?? "null"}` };
  }

  // 2) Penulisan data pasar/keuangan via SERVICE client (RLS menulis pasar
  //    hanya untuk server); kepemilikan tercatat lewat import_batch_id.
  const service = createSupabaseServiceClient();
  try {
    if ("rows" in built) {
      const rows = built.rows.map((row) => ({
        company_id: company.id,
        date: row.date,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
        source_type: "import",
        source_name: form.fileName,
        import_batch_id: batch.id,
      }));
      await chunkedUpsert(service, "market_prices", rows, ["company_id", "date"]);
    } else {
      const rows = built.groups.map((group) => ({
        company_id: company.id,
        statement_type: group.statementType,
        period_type: "annual",
        period_end: group.periodEnd,
        currency: company.currency ?? "USD",
        data_json: group.data,
        source_type: "import",
        source_name: form.fileName,
        import_batch_id: batch.id,
      }));
      await chunkedUpsert(service, "financial_statements", rows, [
        "company_id",
        "statement_type",
        "period_type",
        "period_end",
      ]);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await service
      .from("import_batches")
      .update({ status: "failed", rows_imported: 0 })
      .eq("id", batch.id);
    return { status: "error", message: `Impor gagal, riwayat batch ditandai gagal: ${message}` };
  }

  const { error: finalizeError } = await service
    .from("import_batches")
    .update({ status: "completed", rows_imported: accepted })
    .eq("id", batch.id);
  if (finalizeError) {
    return { status: "error", message: `Impor tertulis tapi status batch gagal diperbarui: ${finalizeError.message}` };
  }

  revalidatePath("/import");
  revalidatePath("/overview");

  return {
    status: "committed",
    message: null,
    committed: {
      dataType: form.dataType,
      fileName: form.fileName,
      companyName: company.name ?? form.ticker,
      imported: accepted,
      rejected: built.rejected.length,
      batchId: batch.id,
    },
  };
}

type WriteRow = Record<string, unknown>;

async function chunkedUpsert(
  service: SupabaseClient,
  table: "market_prices" | "financial_statements",
  rows: WriteRow[],
  conflictColumns: string[],
): Promise<void> {
  for (let index = 0; index < rows.length; index += WRITE_CHUNK) {
    const chunk = rows.slice(index, index + WRITE_CHUNK);
    const { error } = await service
      .from(table)
      .upsert(chunk, { onConflict: conflictColumns.join(",") });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}
