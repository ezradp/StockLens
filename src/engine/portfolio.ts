/**
 * engine/portfolio.ts — mesin portofolio (murni, tanpa I/O).
 *
 * Metode cost basis: RATA-RATA (average cost) — pembelian menaikkan basis rata-rata,
 * penjualan melepas qty pada basis rata-rata lalu membentuk realized P/L.
 * Deposit/withdrawal TIDAK PERNAH masuk P/L investasi (hanya ledger kas).
 *
 * Satu pass agregat: ledger kas + bucket per perusahaan + warning oversell —
 * kas dan realized selalu konsisten satu sama lain (proceeds hanya untuk qty
 * yang benar-benar dipegang; kelebihan qty diabaikan & dilaporkan).
 */

export type TransactionType = "buy" | "sell" | "deposit" | "withdrawal" | "dividend" | "fee";

export interface PortfolioTx {
  transactionType: TransactionType;
  /** YYYY-MM-DD; mesin mengasumsikan urutan naik dari pemanggil (server order). */
  transactionDate: string;
  companyId: string | null;
  quantity: number | null;
  price: number | null;
  amount: number | null;
  fees: number;
  currency: string;
}

export interface CompanyRef {
  companyId: string;
  ticker: string;
  name: string;
  sector: string | null;
  currency: string;
}

export interface LatestPrice {
  price: number | null;
  date: string | null;
}

export interface PositionResult {
  companyId: string;
  ticker: string;
  name: string;
  sector: string | null;
  currency: string;
  /** null = posisi tertutup (sudah terjual semua). */
  quantity: number | null;
  averageCost: number | null;
  costBasis: number | null;
  latestPrice: number | null;
  latestPriceDate: string | null;
  marketValue: number | null;
  unrealizedPl: number | null;
  unrealizedPlPct: number | null;
  realizedPl: number | null;
  totalBought: number | null;
  totalSold: number | null;
}

export interface PortfolioSummary {
  positions: PositionResult[];
  cashBalance: number;
  netDeposits: number;
  dividendsTotal: number;
  feesTotal: number;
  /** Σ realized dari penjualan (posisi terbuka & tertutup). */
  realizedPlTotal: number;
  investedCostOpen: number;
  /** Hanya posisi TERBUKA yang punya harga; sisanya dilaporkan lewat positionsWithoutPrice. */
  marketValueKnown: number | null;
  positionsWithoutPrice: number;
  /** Kas + Σ nilai pasar bila SEMUA posisi terbuka punya harga; else null. */
  totalValue: number | null;
  warnings: string[];
}

export interface AllocationSlice {
  label: string;
  value: number;
  /** Rasio 0..1 atas Σ nilai pasar yang dikenal. */
  share: number;
}

interface CompanyBucket {
  qty: number;
  totalCost: number;
  realized: number;
  bought: number;
  sold: number;
}

interface AggregateState {
  cashBalance: number;
  netDeposits: number;
  dividendsTotal: number;
  feesTotal: number;
  buckets: Map<string, CompanyBucket>;
  warnings: string[];
}

const EMPTY_BUCKET = (): CompanyBucket => ({ qty: 0, totalCost: 0, realized: 0, bought: 0, sold: 0 });

function aggregateTransactions(transactions: PortfolioTx[]): AggregateState {
  const state: AggregateState = {
    cashBalance: 0,
    netDeposits: 0,
    dividendsTotal: 0,
    feesTotal: 0,
    buckets: new Map(),
    warnings: [],
  };

  for (const tx of transactions) {
    const fees = tx.fees ?? 0;
    const companyId = tx.companyId ?? "";

    switch (tx.transactionType) {
      case "deposit":
        state.cashBalance += tx.amount ?? 0;
        state.netDeposits += tx.amount ?? 0;
        break;
      case "withdrawal":
        state.cashBalance -= tx.amount ?? 0;
        state.netDeposits -= tx.amount ?? 0;
        break;
      case "dividend":
        state.cashBalance += tx.amount ?? 0;
        state.dividendsTotal += tx.amount ?? 0;
        break;
      case "fee":
        state.cashBalance -= tx.amount ?? 0;
        state.feesTotal += tx.amount ?? 0;
        break;
      case "buy": {
        const qty = tx.quantity ?? 0;
        const cost = qty * (tx.price ?? 0) + fees;
        state.cashBalance -= cost;
        const bucket = state.buckets.get(companyId) ?? EMPTY_BUCKET();
        bucket.qty += qty;
        bucket.totalCost += cost;
        bucket.bought += qty;
        state.buckets.set(companyId, bucket);
        break;
      }
      case "sell": {
        const bucket = state.buckets.get(companyId) ?? EMPTY_BUCKET();
        const sellQty = tx.quantity ?? 0;
        const released = Math.min(sellQty, bucket.qty);
        if (released < sellQty) {
          state.warnings.push(
            `Sell melebihi qty yang dipegang (${companyId || "?"}) — ${Math.round((sellQty - released) * 1e8) / 1e8} unit diabaikan (tidak dipalsukan; kas juga hanya untuk unit yang sah).`,
          );
        }
        // Fee proporsional atas bagian yang benar-benar dilepas.
        const feeShare = sellQty > 0 ? fees * (released / sellQty) : 0;
        const proceeds = released * (tx.price ?? 0) - feeShare;
        const avg = bucket.qty > 0 ? bucket.totalCost / bucket.qty : 0;
        const soldCost = avg * released;
        state.cashBalance += proceeds;
        bucket.realized += proceeds - soldCost;
        bucket.qty -= released;
        bucket.totalCost -= soldCost;
        bucket.sold += released;
        state.buckets.set(companyId, bucket);
        break;
      }
      default:
        break;
    }
  }

  return state;
}

export function computeCashSummary(transactions: PortfolioTx[]): {
  cashBalance: number;
  netDeposits: number;
  dividendsTotal: number;
  feesTotal: number;
} {
  const state = aggregateTransactions(transactions);
  return {
    cashBalance: state.cashBalance,
    netDeposits: state.netDeposits,
    dividendsTotal: state.dividendsTotal,
    feesTotal: state.feesTotal,
  };
}

export interface ComputePortfolioArgs {
  transactions: PortfolioTx[];
  /** Perusahaan yang relevan (dengan transaksi buy/sell). */
  companies: CompanyRef[];
  latestPrices: Map<string, LatestPrice>;
  /** Mata uang dasar portofolio (kolom portfolios.base_currency). */
  baseCurrency: string;
}

export function computePortfolio(args: ComputePortfolioArgs): PortfolioSummary {
  const { transactions, companies, latestPrices, baseCurrency } = args;
  const companyMap = new Map(companies.map((c) => [c.companyId, c]));
  const state = aggregateTransactions(transactions);

  const openPositions: PositionResult[] = [];
  const closedPositions: PositionResult[] = [];

  for (const [companyId, bucket] of state.buckets) {
    const company = companyMap.get(companyId);
    if (!company) continue;
    if (bucket.bought === 0 && bucket.realized === 0) continue; // kas/dividen tanpa beli — bukan posisi

    const avg = bucket.qty > 0 ? bucket.totalCost / bucket.qty : null;
    const costBasis = bucket.qty > 0 ? bucket.qty * (avg as number) : null;
    const latest = latestPrices.get(companyId) ?? { price: null, date: null };
    const marketValue =
      bucket.qty > 0 && typeof latest.price === "number" ? bucket.qty * latest.price : null;
    const unrealized =
      marketValue !== null && costBasis !== null ? marketValue - costBasis : null;

    const position: PositionResult = {
      companyId,
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      currency: company.currency,
      quantity: bucket.qty > 0 ? bucket.qty : null,
      averageCost: avg,
      costBasis,
      latestPrice: latest.price,
      latestPriceDate: latest.price === null ? null : latest.date,
      marketValue,
      unrealizedPl: unrealized,
      unrealizedPlPct:
        unrealized !== null && costBasis !== null && costBasis > 0 ? unrealized / costBasis : null,
      realizedPl: bucket.realized,
      totalBought: bucket.bought > 0 ? bucket.bought : null,
      totalSold: bucket.sold > 0 ? bucket.sold : null,
    };

    if (bucket.qty > 0) openPositions.push(position);
    else closedPositions.push(position);
  }

  const positions = [...openPositions, ...closedPositions].sort((a, b) =>
    a.ticker.localeCompare(b.ticker),
  );

  const foreign = companies.filter((c) => c.currency !== baseCurrency);
  if (foreign.length > 0) {
    state.warnings.push(
      `Posisi ${foreign.map((c) => c.ticker).join(", ")} memakai mata uang berbeda dari base ${baseCurrency} — tidak dikonversi (tanpa data kurs); angka campuran mata uang disajikan apa adanya per baris.`,
    );
  }

  const positionsWithoutPrice = openPositions.filter((p) => p.marketValue === null).length;
  const knownValue = openPositions
    .filter((p) => p.marketValue !== null)
    .reduce((sum, p) => sum + (p.marketValue as number), 0);
  const marketValueKnown =
    openPositions.length - positionsWithoutPrice > 0 ? knownValue : null;

  const investedCostOpen = openPositions.reduce((sum, p) => sum + (p.costBasis ?? 0), 0);

  const totalValue =
    openPositions.length === 0
      ? state.cashBalance
      : positionsWithoutPrice === 0
        ? knownValue + state.cashBalance
        : null;

  return {
    positions,
    cashBalance: state.cashBalance,
    netDeposits: state.netDeposits,
    dividendsTotal: state.dividendsTotal,
    feesTotal: state.feesTotal,
    realizedPlTotal: positions.reduce((sum, p) => sum + (p.realizedPl ?? 0), 0),
    investedCostOpen,
    marketValueKnown,
    positionsWithoutPrice,
    totalValue,
    warnings: state.warnings,
  };
}

/** Alokasi % atas nilai pasar yang dikenal — posisi tanpa harga tidak dipabrik. */
export function allocationBreakdown(
  positions: PositionResult[],
  key: "company" | "sector",
): { slices: AllocationSlice[]; excluded: number } {
  const known = positions.filter((p) => p.marketValue !== null);
  const excluded = positions.length - known.length;
  const denominator = known.reduce((sum, p) => sum + (p.marketValue as number), 0);
  if (denominator <= 0) return { slices: [], excluded };

  const groups = new Map<string, number>();
  for (const position of known) {
    const label =
      key === "company" ? position.ticker : position.sector ?? "Sektor tidak tercatat";
    groups.set(label, (groups.get(label) ?? 0) + (position.marketValue as number));
  }
  const slices = [...groups.entries()]
    .map(([label, value]) => ({ label, value, share: value / denominator }))
    .sort((a, b) => b.value - a.value);
  return { slices, excluded };
}
