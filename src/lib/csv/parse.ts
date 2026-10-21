/**
 * Wrapper CSV (RFC 4180) di atas papaParse — dependensi yang sudah dipilih Fase 1.
 * Kontrak stabil untuk CSV Import Wizard:
 *  - delimiter otomatis dideteksi (`,` `;` tab) atau dipaksa via opts.
 *  - UTF-8 BOM dibuang; CRLF/LF/CR diterima; baris kosong dilewati greedy.
 *  - Baris ragged diisi "" hingga rata (dipotong/dilapisi) agar tipenya matang.
 *  - Error non-fatal dilaporkan, tidak pernah melempar.
 */
import Papa, { type ParseResult } from "papaparse";

type PapaError = ParseResult<string[]>["errors"][number];

export type CsvDelimiter = "," | ";" | "\t";

export interface CsvParseError {
  /** Nomor baris data (berbasis 1; baris data pertama = 1 — header tidak dihitung). */
  line: number;
  message: string;
}

export interface CsvParseResult {
  /** Header di-trim; dipakai untuk pemetaan kolom di wizard. */
  headers: string[];
  /** Baris data (header dilepas), selalu selebar headers. */
  rows: string[][];
  delimiter: CsvDelimiter;
}

const DELIMITERS: CsvDelimiter[] = [",", ";", "\t"];

/** Tebak delimiter dari frekuensi karakter di luar kutip pada baris pertama. */
export function detectDelimiter(text: string): CsvDelimiter {
  const withoutBom = text.replace(/^\uFEFF/, "");
  const firstLine = withoutBom.split(/\r\n|\r|\n/, 1)[0] ?? "";
  let best: CsvDelimiter = ",";
  let bestCount = -1;
  for (const delimiter of DELIMITERS) {
    let count = 0;
    let inQuotes = false;
    for (const char of firstLine) {
      if (char === '"') inQuotes = !inQuotes;
      else if (!inQuotes && char === delimiter) count += 1;
    }
    if (count > bestCount) {
      bestCount = count;
      best = delimiter;
    }
  }
  return best;
}

/**
 * Parse string CSV menjadi { headers, rows, errors }.
 * Perbaikan input sebelum Papa: normalisasi CRLF/CR → LF (Papa memakai newline
 * pertama yang ditemukan sebagai mode — tanpa normalisasi, campuran \r\n dan \n
 * membuat terminator berikutnya dihitung sebagai isi field).
 */
export function parseCsv(text: string, opts: { delimiter?: CsvDelimiter } = {}) {
  const delimiter = opts.delimiter ?? detectDelimiter(text);
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const parsed = Papa.parse<string[]>(normalized, {
    delimiter,
    skipEmptyLines: "greedy",
  });

  const [headerRow = [], ...dataRows] = parsed.data;
  const headers = headerRow.map((value) => value.trim());
  const width = headers.length;

  const rows = dataRows.map((row) => {
    if (row.length === width) return row;
    if (row.length > width) return row.slice(0, width);
    return [...row, ...Array<string>(width - row.length).fill("")];
  });

  const errors: CsvParseError[] = mapParseErrors(parsed);
  return { headers, rows, delimiter, errors };
}

function mapParseErrors(parsed: ParseResult<string[]>): CsvParseError[] {
  return parsed.errors.map((error: PapaError): CsvParseError => {
    const row = typeof error.row === "number" && error.row >= 0 ? error.row : 0;
    // Papa meng-index data (header:false) terhadap baris data; baris data ke-1 → line 1.
    return {
      line: row + 1,
      message:
        error.type === "Quotes"
          ? "Tanda kutip tidak tertutup di baris ini"
          : error.message,
    };
  });
}

/** Koersi angka toleran: prefix Rp/US$/, %, spasi, koma desimal Eropa/servicesribuan titik. */
export function parseNumberLoose(value: string): number | null {
  const cleaned = value
    .trim()
    .replace(/^(?:rp|us\$|\$|€|£)\s*/i, "")
    .replace(/[%\s]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === "–") return null;
  if (!/^[-\d.,]+$/.test(cleaned)) return null;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalized = cleaned;

  if (hasComma && hasDot) {
    // Pemisah yang muncul paling akhir dianggap desimal.
    if (cleaned.lastIndexOf(".") > cleaned.lastIndexOf(",")) {
      normalized = cleaned.replaceAll(",", ""); // 1,234.56
    } else {
      normalized = cleaned.replaceAll(".", "").replaceAll(",", "."); // 1.234,56
    }
  } else if (hasComma && /^-?\d{1,3}(,\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replaceAll(",", ""); // 1,234 → ribuan
  } else if (hasComma) {
    normalized = cleaned.replaceAll(",", "."); // 1,25 → desimal
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replaceAll(".", ""); // 12.500 → ribuan (gaya ID)
  }

  const parsedNum = Number(normalized);
  return Number.isFinite(parsedNum) ? parsedNum : null;
}
