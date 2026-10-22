/**
 * Utilitas format angka/spesifikasi keuangan (PRD §6: tabular numerals).
 * Semua formatter menampilkan "—" ketika data tidak tersedia — tidak ada angka buatan.
 */

const LOCALE = "en-US";

export function formatCurrency(value: number | null | undefined, currency = "USD"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Persentase dari rasio (0.12 → "+12.0%"); signed opsional untuk P/L. */
export function formatPercent(
  ratio: number | null | undefined,
  { signed = false, digits = 2 } = {},
): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  return new Intl.NumberFormat(LOCALE, {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: signed ? "always" : "auto",
  }).format(ratio);
}

export function formatNumber(
  value: number | null | undefined,
  digits = 2,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium" }).format(date);
}

/** Nilai keuangan besar: $1.09B / $3.2T — label eksplisit dibutuhkan di pemanggil. */
export function formatCompactCurrency(value: number | null | undefined, currency = "USD"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const compact = new Intl.NumberFormat(LOCALE, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  const prefix = value < 0 ? "-" : "";
  return `${prefix}${currency === "USD" ? "$" : `${currency} `}${compact}`;
}
