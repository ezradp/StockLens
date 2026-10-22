/**
 * engine/dcf.ts — mesin discounted cash flow (murni, tanpa I/O).
 *
 * Model transparan:
 *   FCF_t   = FCF₀ × Π(1 + g_i)          (proyeksi eksplisit, laju per tahun)
 *   PV(t)   = FCF_t / (1 + r)^t
 *   TV      = FCF_N × (1 + gT) / (r − gT)          (Gordon; gT < r wajib)
 *   EV      = Σ PV(t) + PV(TV)
 *   Equity  = EV − NetDebt        (NetDebt bisa negatif = kas bersih)
 *   PerShare= Equity / Shares
 *   MoS     = 1 − Harga / PerShare
 *
 * Prinsip: data/asumsi tidak tersedia → null + pesan galat eksplisit, tidak
 * pernah memalsukan angka. Kalkulasi parsial tetap dilaporkan (mis. gT ≥ r →
 * PV eksplisit tetap dipaparkan, TV dilucuti).
 */

export type FinancialMetric = number | null;

export interface DcfInput {
  /** FCF tahun dasar (t0) — harus > 0. */
  baseFcf: number;
  /** Laju pertumbuhan rasio per tahun proyeksi (mis. 0,10). Boleh negatif (> −1). */
  yearlyGrowth: number[];
  /** Diskonte (WACC proxy) — rasio > 0. */
  discountRate: number;
  /** Pertumbuhan terminal — harus < discountRate. */
  terminalGrowth: number;
  /** Hutang total (atau liabilitas) − kas; negatif berarti kas bersih. */
  netDebt: FinancialMetric;
  /** Saham beredar; > 0 untuk nilai per saham. */
  sharesOutstanding: FinancialMetric;
  /** Harga acuan pasar untuk margin of safety. */
  currentPrice: FinancialMetric;
}

export interface DcfResult {
  baseFcf: number;
  projectedFcf: number[] | null;
  discountedFcf: number[] | null;
  pvExplicit: FinancialMetric;
  terminalValue: FinancialMetric;
  pvTerminalValue: FinancialMetric;
  enterpriseValue: FinancialMetric;
  equityValue: FinancialMetric;
  perShare: FinancialMetric;
  marginOfSafety: FinancialMetric;
  errors: string[];
}

export interface FcfHistoryPoint {
  periodEnd: string;
  operatingCashFlow: FinancialMetric;
  capex: FinancialMetric;
  /** opCashFlow − |capex| — null bila salah satu tak tersedia. */
  fcf: FinancialMetric;
}

export interface DcfHistoryContext {
  fcfHistory: FcfHistoryPoint[];
  revenueCagr3y: FinancialMetric;
  revenueCagr5y: FinancialMetric;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function computeCore(
  baseFcf: number,
  yearlyGrowth: number[],
  discountRate: number,
  terminalGrowth: number,
): Pick<DcfResult, "projectedFcf" | "discountedFcf" | "pvExplicit" | "terminalValue" | "pvTerminalValue" | "enterpriseValue"> {
  const projectedFcf: number[] = [];
  const discountedFcf: number[] = [];
  let runningFcf = baseFcf;

  for (let index = 0; index < yearlyGrowth.length; index += 1) {
    runningFcf *= 1 + yearlyGrowth[index];
    projectedFcf.push(runningFcf);
    discountedFcf.push(runningFcf / Math.pow(1 + discountRate, index + 1));
  }

  const pvExplicit = discountedFcf.reduce((sum, value) => sum + value, 0);
  const periods = yearlyGrowth.length;

  // Gordon: bila gT ≥ r terminal value mendekati/melampaui tak hingga — dilucuti.
  const validTerminal = terminalGrowth < discountRate;
  const terminalValue = validTerminal
    ? runningFcf * (1 + terminalGrowth) / (discountRate - terminalGrowth)
    : null;
  const pvTerminalValue = validTerminal && discountedFcf.length > 0
    ? (terminalValue as number) / Math.pow(1 + discountRate, periods)
    : null;
  const enterpriseValue =
    pvTerminalValue !== null ? pvExplicit + pvTerminalValue : null;

  return {
    projectedFcf,
    discountedFcf,
    pvExplicit,
    terminalValue,
    pvTerminalValue,
    enterpriseValue,
  };
}

export function buildEmptyResult(errors: string[]): DcfResult {
  return {
    baseFcf: 0,
    projectedFcf: null,
    discountedFcf: null,
    pvExplicit: null,
    terminalValue: null,
    pvTerminalValue: null,
    enterpriseValue: null,
    equityValue: null,
    perShare: null,
    marginOfSafety: null,
    errors,
  };
}

export function computeDcf(input: DcfInput): DcfResult {
  const errors: string[] = [];

  if (!isFiniteNumber(input.baseFcf) || input.baseFcf <= 0) {
    errors.push("FCF dasar harus angka positif.");
    return buildEmptyResult(errors);
  }
  if (!Array.isArray(input.yearlyGrowth) || input.yearlyGrowth.length === 0) {
    errors.push("Butuh minimal satu tahun proyeksi.");
    return buildEmptyResult(errors);
  }
  if (!input.yearlyGrowth.every((g) => isFiniteNumber(g) && g > -1)) {
    errors.push("Laju pertumbuhan tiap tahun harus angka > −100%.");
    return buildEmptyResult(errors);
  }
  if (!isFiniteNumber(input.discountRate) || input.discountRate <= 0) {
    errors.push("Diskonto (WACC) harus angka positif.");
    return buildEmptyResult(errors);
  }
  if (!isFiniteNumber(input.terminalGrowth)) {
    errors.push("Pertumbuhan terminal harus angka.");
    return buildEmptyResult(errors);
  }
  if (
    (input.netDebt !== null && !isFiniteNumber(input.netDebt)) ||
    (input.sharesOutstanding !== null && (!isFiniteNumber(input.sharesOutstanding) || input.sharesOutstanding <= 0)) ||
    (input.currentPrice !== null && (!isFiniteNumber(input.currentPrice) || input.currentPrice <= 0))
  ) {
    errors.push("NetDebt / saham beredar / harga acuan tidak valid (saham & harga harus > 0 bila diisi).");
    return buildEmptyResult(errors);
  }

  const core = computeCore(
    input.baseFcf,
    input.yearlyGrowth,
    input.discountRate,
    input.terminalGrowth,
  );

  if (core.terminalValue === null) {
    errors.push(
      `Pertumbuhan terminal (${(input.terminalGrowth * 100).toFixed(2)}%) harus di bawah diskonto (${(input.discountRate * 100).toFixed(2)}%) — terminal value dilucuti.`,
    );
  }

  const equityValue =
    core.enterpriseValue === null
      ? null
      : input.netDebt === null
        ? core.enterpriseValue
        : core.enterpriseValue - input.netDebt;

  let perShare: FinancialMetric = null;
  if (equityValue !== null && input.sharesOutstanding !== null) {
    perShare = equityValue / input.sharesOutstanding;
  }

  let marginOfSafety: FinancialMetric = null;
  if (perShare !== null && perShare > 0 && input.currentPrice !== null) {
    marginOfSafety = 1 - input.currentPrice / perShare;
  }

  return {
    baseFcf: input.baseFcf,
    ...core,
    equityValue,
    perShare,
    marginOfSafety,
    errors,
  };
}

/**
 * Matriks sensitivitas per-saham — baris = diskonto, kolom = pertumbuhan terminal.
 * Sel null bila input saham tak tersedia atau gT tidak valid untuk r-baris itu.
 */
export function sensitivityPerShare(
  input: Pick<DcfInput, "baseFcf" | "yearlyGrowth" | "netDebt" | "sharesOutstanding">,
  discountRates: number[],
  terminalGrowths: number[],
): { rows: number[]; columns: number[]; values: Array<Array<FinancialMetric>>; errors: string[] } {
  const errors: string[] = [];
  const sharesValid = isFiniteNumber(input.sharesOutstanding) && input.sharesOutstanding > 0;
  if (!sharesValid) {
    errors.push("Matriks sensitivitas per-saham butuh jumlah saham beredar > 0.");
  }

  const baseGrowthValid = input.yearlyGrowth.length > 0 && input.yearlyGrowth.every((g) => isFiniteNumber(g) && g > -1);
  if (!baseGrowthValid) {
    errors.push("Matriks butuh laju pertumbuhan proyeksi yang valid.");
  }

  const values: Array<Array<FinancialMetric>> = discountRates.map((rate) =>
    terminalGrowths.map((growth) => {
      if (!sharesValid || !baseGrowthValid || !(growth < rate) || !isFiniteNumber(rate)) return null;
      const core = computeCore(input.baseFcf, input.yearlyGrowth, rate, growth);
      if (core.enterpriseValue === null) return null;
      const equity = input.netDebt === null ? core.enterpriseValue : core.enterpriseValue - input.netDebt;
      return equity / (input.sharesOutstanding as number);
    }),
  );

  return { rows: discountRates, columns: terminalGrowths, values, errors };
}

/** Riwayat FCF per baran anual — pasangan operasi & capex dari baris yang sama. */
export function buildFcfHistory(statements: Array<{
  statementType: "income_statement" | "balance_sheet" | "cash_flow";
  periodEnd: string;
  data: Record<string, number>;
}>): FcfHistoryPoint[] {
  const cashflow = [...statements]
    .filter((row) => row.statementType === "cash_flow")
    .sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));

  return cashflow.map((row) => {
    const opcf = typeof row.data.operating_cash_flow === "number" && Number.isFinite(row.data.operating_cash_flow)
      ? row.data.operating_cash_flow
      : null;
    const capex = typeof row.data.capex === "number" && Number.isFinite(row.data.capex) ? row.data.capex : null;
    return {
      periodEnd: row.periodEnd,
      operatingCashFlow: opcf,
      capex,
      fcf: opcf !== null && capex !== null ? opcf - Math.abs(capex) : null,
    };
  });
}
