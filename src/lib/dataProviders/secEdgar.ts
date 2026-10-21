/**
 * Klien SEC EDGAR (data.sec.gov) — gratis, tanpa key (PRD: zero-cost-first).
 * Kepatuhan:
 *  - User-Agent wajib berisi kontak, rate limit ≤ 10 req/detik (default 150 ms gap).
 *  - Konten EDGAR bisa di-reuse sesuai FAQ resmi SEC; data seed diberi label sumber.
 *
 * File ini TIDAK mengimpor "server-only"/next* — dipakai juga oleh script seed Node murni.
 */

/** data.sec.gov untuk API; www.sec.gov untuk file statis (peta ticker). */
const EDGAR_BASE = "https://data.sec.gov";
const EDGAR_WWW_BASE = "https://www.sec.gov";
/** U_override: kirim kontak untuk kepatuhan; bisa dioverride via env. */
export const EDGAR_USER_AGENT =
  process.env.EDGAR_USER_AGENT ?? "StockLens/0.1 (web investment research; contact: admin@stocklens.app)";

/** Jeda minimum antar request (ms) → maks ≈ 6.6 req/detik, aman di bawah 10 req/detik. */
const MIN_REQUEST_GAP_MS = 150;
const REQUEST_TIMEOUT_MS = 20_000;

let lastRequestAt = 0;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function respectRateLimit(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_REQUEST_GAP_MS) await sleep(MIN_REQUEST_GAP_MS - elapsed);
  lastRequestAt = Date.now();
}

export async function fetchEdgarJson<T>(pathOrUrl: string): Promise<T> {
  await respectRateLimit();
  const target = pathOrUrl.startsWith("https://")
    ? pathOrUrl
    : `${EDGAR_BASE}${pathOrUrl}`;
  const response = await fetch(target, {
    headers: { "User-Agent": EDGAR_USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`EDGAR ${target} → HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Peta ticker → CIK (satu file besar gratis dari SEC).
// ---------------------------------------------------------------------------

export interface TickerEntry {
  ticker: string;
  cik: number;
  title: string;
}

interface RawTickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

/** https://www.sec.gov/files/company_tickers.json → { "0": {cik_str, ticker, title} } */
export async function fetchTickerMap(): Promise<Map<string, TickerEntry>> {
  const raw = await fetchEdgarJson<Record<string, RawTickerEntry>>(
    `${EDGAR_WWW_BASE}/files/company_tickers.json`,
  );
  const map = new Map<string, TickerEntry>();
  for (const entry of Object.values(raw)) {
    map.set(entry.ticker.replace(/\./g, "").toUpperCase(), {
      ticker: entry.ticker.toUpperCase(),
      cik: entry.cik_str,
      title: entry.title,
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// CompanyFacts + profil (SIC) per perusahaan.
// ---------------------------------------------------------------------------

/** https://data.sec.gov/api/xbrl/companyfacts/CIK{10digit}.json */
export async function fetchCompanyFacts(cik: number): Promise<CompanyFacts> {
  const padded = String(cik).padStart(10, "0");
  return fetchEdgarJson<CompanyFacts>(`/api/xbrl/companyfacts/CIK${padded}.json`);
}

export interface CompanyProfile {
  name: string;
  /** Deskripsi kode SIC dari submissions — disimpan sebagai `sector` di DB. */
  sector: string | null;
  /** Nilai SIC mentah (mis. 2836) — disimpan sebagai `industry` di DB. */
  industry: string | null;
}

interface SubmissionsPayload {
  results?: {
    name?: string;
    sicDescription?: string;
    sic?: string;
  };
}

/** Profil perusahaan via `/submissions` — gagal tetap tak menghentikan seed (null). */
export async function fetchCompanyProfile(cik: number): Promise<CompanyProfile | null> {
  try {
    const padded = String(cik).padStart(10, "0");
    const payload = await fetchEdgarJson<SubmissionsPayload>(`/submissions/CIK${padded}.json`);
    const results = payload.results ?? {};
    return {
      name: results.name ?? "",
      sector: results.sicDescription?.trim() || null,
      industry: results.sic?.trim() || null,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Ekstraksi laporan keuangan tahunan dari companyfacts XBRL.
// ---------------------------------------------------------------------------

export interface FactUnit {
  start?: string;
  end: string;
  val: number;
  fy?: number;
  fp?: string;
  form?: string;
  frame?: string | null;
}

export interface CompanyFacts {
  entityName?: string;
  facts?: {
    "us-gaap"?: Record<string, { label?: string; units?: Record<string, FactUnit[]> }>;
  };
}

export type StatementType = "income_statement" | "balance_sheet" | "cash_flow";

export interface StatementDraft {
  statementType: StatementType;
  /** YYYY-MM-DD (end) — kunci kejujuran period, disimpan apa adanya. */
  periodEnd: string;
  /** Tahun fiskal (angka). */
  fiscalYear: number;
  /** Metrik snake_case → nilai. Ditaruh mentah; UI Fase 4 merender sesuai statement. */
  data: Record<string, number>;
}

export interface ConceptRule {
  key: string;
  tags: string[];
  kind: "duration" | "instant";
  statement: StatementType;
}

/** Prioritas tag us-gaap — pertama yang tersedia menang (variasi perusahaan). */
export const CONCEPT_RULES: ConceptRule[] = [
  { key: "revenue", tags: ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"], kind: "duration", statement: "income_statement" },
  { key: "net_income", tags: ["NetIncomeLoss"], kind: "duration", statement: "income_statement" },
  { key: "operating_income", tags: ["OperatingIncomeLoss"], kind: "duration", statement: "income_statement" },
  { key: "total_assets", tags: ["Assets"], kind: "instant", statement: "balance_sheet" },
  { key: "total_liabilities", tags: ["Liabilities"], kind: "instant", statement: "balance_sheet" },
  { key: "total_equity", tags: ["StockholdersEquity"], kind: "instant", statement: "balance_sheet" },
  { key: "cash", tags: ["CashAndCashEquivalentsAtCarryingValue"], kind: "instant", statement: "balance_sheet" },
  { key: "operating_cash_flow", tags: ["NetCashProvidedByUsedInOperatingActivities"], kind: "duration", statement: "cash_flow" },
  { key: "capex", tags: ["PaymentsToAcquirePropertyPlantAndEquipment"], kind: "duration", statement: "cash_flow" },
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toIsoDate(iso: string): string {
  return iso.slice(0, 10);
}

function parseIso(date: string): number {
  return Date.parse(date);
}

function daySpan(u: FactUnit): number | null {
  if (!u.start) return null;
  const span = parseIso(u.end) - parseIso(u.start);
  return Number.isFinite(span) ? span / MS_PER_DAY : null;
}

/** Unit USD, bentuk 10-K; duration ≥ ~9.5 bln; buang nilai duplikat identik. */
function pickAnnualUsdEntries(units: Record<string, FactUnit[]> | undefined): FactUnit[] {
  const usd = units?.USD ?? [];
  return usd.filter((u) => {
    if (typeof u.val !== "number" || !Number.isFinite(u.val)) return false;
    if (u.form && !u.form.startsWith("10-")) return false;
    if (u.start) {
      const span = daySpan(u);
      if (span === null || span < 330) return false; // kuartal/semester terfilter di sini
    }
    return true;
  });
}

/** Buang duplikat untuk (end,start) sama — EDGAR sering mengulang nilai di beberapa filing. */
function dedupeSamePeriod(entries: FactUnit[]): FactUnit[] {
  const byPeriod = new Map<string, FactUnit>();
  for (const entry of entries) {
    const key = `${entry.start ?? ""}|${toIsoDate(entry.end)}`;
    const existing = byPeriod.get(key);
    if (!existing) {
      byPeriod.set(key, entry);
      continue;
    }
    // Prefer entri ber-frame CY (tahunan standar) → lalu fy lebih baru → lalu form 10-K.
    const score = (e: FactUnit) =>
      (e.frame?.startsWith("CY") ? 100 : 0) + (e.fy ?? 0) + (e.form === "10-K" ? 10 : 0);
    if (score(entry) > score(existing)) byPeriod.set(key, entry);
  }
  return [...byPeriod.values()];
}

export interface BuiltStatements {
  /** Satu draft per (statement_type, tahun fiskal) — siap dikonversi baris DB. */
  statements: StatementDraft[];
  /** Metrik tidak tersedia (tidak ada tag cocok) — kelaparan transapar. */
  missingConcepts: string[];
}

/**
 * Bangun draft laporan tahunan dari companyfacts.
 * - Setiap bucket = satuan (statement_type, tahun fiskal); duration dipasangkan via end-nya.
 * - Batasi himpunan tahun terakhir supaya seed fokus pada data yang relevan.
 */
export function buildStatementsFromCompanyFacts(facts: CompanyFacts, opts: { maxYears?: number } = {}): BuiltStatements {
  const usGaap = facts.facts?.["us-gaap"] ?? {};
  const maxYears = opts.maxYears ?? 10;

  // Kumpulkan entry per rule dulu.
  type PerRule = { rule: ConceptRule; entries: FactUnit[] };
  const perRule: PerRule[] = [];
  const missing: string[] = [];

  for (const rule of CONCEPT_RULES) {
    let entries: FactUnit[] = [];
    for (const tag of rule.tags) {
      const concept = usGaap[tag];
      if (!concept?.units) continue;
      const picked = dedupeSamePeriod(pickAnnualUsdEntries(concept.units));
      if (picked.length > 0) {
        entries = picked;
        break;
      }
    }
    if (entries.length === 0) {
      missing.push(rule.key);
      continue;
    }
    perRule.push({ rule, entries });
  }

  if (perRule.length === 0) return { statements: [], missingConcepts: missing };

  // Tentukan himpunan tahun umum: gabungan fy/fallback end-year, ambil N tahun terakhir.
  const years = new Set<number>();
  for (const { entries } of perRule) {
    for (const entry of entries) {
      years.add(entry.fy ?? Number.parseInt(toIsoDate(entry.end).slice(0, 4), 10));
    }
  }
  const recentYears = [...years].sort((a, b) => b - a).slice(0, maxYears);
  const yearSet = new Set(recentYears);

  // Hasil per (statement, periodEnd/fy).
  const buckets = new Map<string, StatementDraft>();
  for (const { rule, entries } of perRule) {
    for (const entry of entries) {
      const periodEnd = toIsoDate(entry.end);
      const year = entry.fy ?? Number.parseInt(periodEnd.slice(0, 4), 10);
      if (!yearSet.has(year)) continue;
      const key = `${rule.statement}|${year}`;
      const existing = buckets.get(key) ?? {
        statementType: rule.statement,
        periodEnd,
        fiscalYear: year,
        data: {} as Record<string, number>,
      };
      // Bungkus: setiap metrik cukup satu nilai per tahun; periodEnd tetap
      // tanggal end dari entri pertama yang membuat bucket (semua 10-K satu fisik tahun
      // memakai tanggal fiskal yang sama).
      existing.data[rule.key] = entry.val;
      buckets.set(key, existing);
    }
  }

  const statements = [...buckets.values()].sort(
    (a, b) => a.statementType.localeCompare(b.statementType) || b.fiscalYear - a.fiscalYear,
  );
  return { statements, missingConcepts: missing };
}
