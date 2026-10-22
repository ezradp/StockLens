import type { HeaderMapping, ImportDataType, ImportRejection } from "@/lib/csv/import";

/** Kontrak state wizard Import — dipisah dari actions.ts ("use server" hanya boleh fungsi async). */
export interface ImportSampleCell {
  label: string;
  value: string;
}

export interface ImportPreviewState {
  dataType: ImportDataType;
  fileName: string;
  totalRows: number;
  accepted: number;
  rejected: number;
  /** prices: tanggal duplikat; fundamentals: metrik identik yang digabung. */
  duplicates: number;
  mapping: HeaderMapping[];
  ignoredColumns: string[];
  missingColumns: string[];
  sample: ImportSampleCell[][];
  rejectionSamples: ImportRejection[];
}

export interface CommittedImport {
  dataType: ImportDataType;
  fileName: string;
  companyName: string;
  imported: number;
  rejected: number;
  batchId: string;
}

export interface ImportActionState {
  status: "idle" | "error" | "preview" | "committed";
  message: string | null;
  preview?: ImportPreviewState;
  committed?: CommittedImport;
}

export const IMPORT_INITIAL_STATE: ImportActionState = { status: "idle", message: null };
