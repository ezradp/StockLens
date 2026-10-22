/**
 * engine/insights.ts — wawasan ATURAN TETAP (murni, tanpa I/O, tanpa AI).
 * Setiap aturan hanya menyala bila metriknya ADA (null → tidak ada wawasan,
 * bukan wawasan palsu). Aturan diekspos untuk ditampilkan berikut penjelasannya.
 */
import type { ScreenerRow } from "@/engine/screener";

export type InsightTone = "positive" | "neutral" | "caution";

export interface Insight {
  ruleId: string;
  tone: InsightTone;
  /** Bahasa Indonesia; angka eksplisit di dalam teks agar bisa ditelusuri. */
  text: string;
}

type Rule = {
  id: string;
  tone: InsightTone;
  /** Kembalikan teks bila aturan menyala; null bila metrik tidak ada/tidak menyala. */
  fire: (row: ScreenerRow) => string | null;
};

export const INSIGHT_RULES: readonly Rule[] = [
  {
    id: "no_statements",
    tone: "neutral",
    fire: (row) =>
      row.latestPeriodEnd === null ? "Belum ada laporan keuangan tersimpan — jalankan seed/impor dulu." : null,
  },
  {
    id: "net_margin_strong",
    tone: "positive",
    fire: (row) =>
      row.netMargin !== null && row.netMargin >= 0.2
        ? `Margin laba bersih sehat: ${pct(row.netMargin)} (≥ 20%).`
        : null,
  },
  {
    id: "net_margin_thin",
    tone: "caution",
    fire: (row) =>
      row.netMargin !== null && row.netMargin > 0 && row.netMargin < 0.05
        ? `Margin laba bersih tipis: ${pct(row.netMargin)} (< 5%).`
        : null,
  },
  {
    id: "net_margin_loss",
    tone: "caution",
    fire: (row) =>
      row.netMargin !== null && row.netMargin <= 0
        ? `Margin laba bersih negatif (${pct(row.netMargin)}) — periode terakhir mencatat kerugian.`
        : null,
  },
  {
    id: "roe_strong",
    tone: "positive",
    fire: (row) =>
      row.roe !== null && row.roe >= 0.15 ? `ROE baik: ${pct(row.roe)} (≥ 15%) — laba terhadap ekuitas seperiode.` : null,
  },
  {
    id: "roe_weak",
    tone: "caution",
    fire: (row) =>
      row.roe !== null && row.roe < 0.05 && row.roe >= 0
        ? `ROE tipis: ${pct(row.roe)} (< 5%).`
        : null,
  },
  {
    id: "roe_negative",
    tone: "caution",
    fire: (row) =>
      row.roe !== null && row.roe < 0 ? `ROE negatif (${pct(row.roe)}) — kerugian terhadap ekuitas.` : null,
  },
  {
    id: "leverage_low",
    tone: "positive",
    fire: (row) =>
      row.de !== null && row.de >= 0 && row.de <= 0.5
        ? `Leverage rendah: hutang/liabilitas ${ratio(row.de)}× ekuitas (≤ 0.5×).`
        : null,
  },
  {
    id: "leverage_high",
    tone: "caution",
    fire: (row) =>
      row.de !== null && row.de >= 2
        ? `Leverage tinggi: hutang/liabilitas ${ratio(row.de)}× ekuitas (≥ 2×).`
        : null,
  },
  {
    id: "liab_assets_high",
    tone: "caution",
    fire: (row) =>
      row.liabilitiesToAssets !== null && row.liabilitiesToAssets >= 0.85
        ? `Liabilitas ${pct(row.liabilitiesToAssets)} dari aset (≥ 85%) — bantalan modal tipis.`
        : null,
  },
  {
    id: "fcf_margin_ok",
    tone: "positive",
    fire: (row) =>
      row.fcfMargin !== null && row.fcfMargin >= 0.08
        ? `Margin arus kas bebas baik: ${pct(row.fcfMargin)} (≥ 8%; kas operasi − |capex|).`
        : null,
  },
  {
    id: "fcf_negative",
    tone: "caution",
    fire: (row) =>
      row.fcf !== null && row.fcf <= 0
        ? "Arus kas bebas negatif — kas operasi tidak menutup capex periode terakhir."
        : null,
  },
  {
    id: "grow_fast",
    tone: "positive",
    fire: (row) =>
      row.revenueGrowth1y !== null && row.revenueGrowth1y >= 0.1
        ? `Pendapatan tumbuh ${pct(row.revenueGrowth1y)} setahun terakhir (≥ 10%, tahun sejajar).`
        : null,
  },
  {
    id: "grow_shrink",
    tone: "caution",
    fire: (row) =>
      row.revenueGrowth1y !== null && row.revenueGrowth1y <= -0.1
        ? `Pendapatan menyusut ${pct(row.revenueGrowth1y)} setahun terakhir (≤ −10%).`
        : null,
  },
  {
    id: "cagr3_ok",
    tone: "positive",
    fire: (row) =>
      row.revenueGrowth3y !== null && row.revenueGrowth3y >= 0.1
        ? `Pendapatan CAGR 3 tahun ${pct(row.revenueGrowth3y)} (≥ 10%).`
        : null,
  },
  {
    id: "pe_low",
    tone: "positive",
    fire: (row) =>
      row.pe !== null && row.pe > 0 && row.pe <= 15
        ? `P/E relatif rendah: ${ratio(row.pe)} (≤ 15) — butuh EPS terimpor & harga tersedia.`
        : null,
  },
  {
    id: "pe_high",
    tone: "caution",
    fire: (row) =>
      row.pe !== null && row.pe >= 40
        ? `P/E tinggi: ${ratio(row.pe)} (≥ 40).`
        : null,
  },
  {
    id: "price_down",
    tone: "caution",
    fire: (row) =>
      row.priceReturn1y !== null && row.priceReturn1y <= -0.2
        ? `Harga turun ${pct(row.priceReturn1y)} dalam ~1 tahun (patokan −365 hari ±92).`
        : null,
  },
  {
    id: "price_up",
    tone: "neutral",
    fire: (row) =>
      row.priceReturn1y !== null && row.priceReturn1y >= 0.2
        ? `Harga naik ${pct(row.priceReturn1y)} dalam ~1 tahun — momentum bukan alasan beli; cek fundamentalnya.`
        : null,
  },
  {
    id: "score_high",
    tone: "positive",
    fire: (row) =>
      row.score !== null && row.score >= 70
        ? `Skor fundamental tinggi: ${Math.round(row.score)} dari 100 (aturan tetap transparan).`
        : null,
  },
  {
    id: "score_low",
    tone: "caution",
    fire: (row) =>
      row.score !== null && row.score <= 30
        ? `Skor fundamental rendah: ${Math.round(row.score)} dari 100 — banyak metrik di bawah ambang.`
        : null,
  },
];

const TONE_ORDER: Record<InsightTone, number> = { positive: 0, neutral: 1, caution: 2 };

function pct(ratio: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(ratio);
}

function ratio(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

export function buildInsights(row: ScreenerRow): Insight[] {
  const insights: Insight[] = [];
  for (const rule of INSIGHT_RULES) {
    const text = rule.fire(row);
    if (text !== null) insights.push({ ruleId: rule.id, tone: rule.tone, text });
  }
  return insights.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

/** Ringkasan metrik yang HILANG supaya "tidak ada wawasan" tidak terasa diam-diam. */
export function insightCoverage(row: ScreenerRow): string[] {
  const entries: Array<[string, boolean]> = [
    ["laporan keuangan", row.latestPeriodEnd !== null],
    ["P/E", row.pe !== null],
    ["arus kas bebas", row.fcf !== null],
    ["hutang÷ekuitas", row.de !== null],
    ["ROE", row.roe !== null],
    ["harga acuan", row.latestClose !== null],
  ];
  return entries.filter(([, present]) => !present).map(([label]) => label);
}
