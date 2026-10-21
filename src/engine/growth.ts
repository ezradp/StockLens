/**
 * engine/growth.ts — kalkulasi pertumbuhan murni, tanpa I/O dan tanpa State.
 * Semua formula finansial StockLens hidup di src/engine agar bisa diuji unit
 * dan diguna ulang di server maupun browser.
 */

export interface CagrInput {
  startValue: number;
  endValue: number;
  years: number;
}

/**
 * CAGR (Compound Annual Growth Rate): (end/start)^(1/years) − 1.
 *
 * Mengembalikan `null` (bukan 0, bukan NaN) untuk input tidak valid atau data
 * tidak mencukupi — sesuai prinsip PRD §4.5 "data tidak tersedia bukan angka nol".
 * Konsumen harus menyajikan "—"/N/A untuk hasil null.
 */
export function computeCagr(input: CagrInput): number | null {
  const { startValue, endValue, years } = input;

  if (
    !Number.isFinite(input.startValue) ||
    !Number.isFinite(input.endValue) ||
    !Number.isFinite(input.years)
  ) {
    return null;
  }
  if (startValue <= 0 || endValue <= 0 || years <= 0) {
    return null;
  }

  return Math.pow(endValue / startValue, 1 / years) - 1;
}

/** CAGR bentuk rasio (0.18) → persentase (18.0) untuk penyajian produktif. */
export function cagrToPercent(cagr: number | null): number | null {
  return cagr === null ? null : cagr * 100;
}
