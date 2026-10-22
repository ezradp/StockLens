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
  /** Respons /submissions menaruh field di root; `results` dipertahankan untuk kompatibilitas. */
  name?: string;
  sicDescription?: string;
  sic?: string;
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
    const fields = payload.results ?? payload;
    return {
      name: fields.name?.trim() ?? "",
      sector: fields.sicDescription?.trim() || null,
      industry: fields.sic?.trim() || null,
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
  /** Jangkar: period end-nya menentukan jendela statement ini di window maksYears. */
  anchor?: boolean;
}

/** Prioritas tag us-gaap. Isi NILAI dilakukan PER PERIODE dengan fallback:
 * tag pertama yang punya entri utk periode tsb menang — sehingga tag usang
 * (AAPL "Revenues" 3 entri)—TETAP memicu periode lama yang tag modern tak punya,
 * tanpa pernah menimpa tag modern. Selama ini pemilihan global "tag pertama /
 * tag terbanyak" gagal karena XBRL fy = TAHUN FILINGS, bukan tahun periode. */
export const CONCEPT_RULES: ConceptRule[] = [
  {
    key: "revenue",
    tags: [
      "Revenues",
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "RevenueFromContractWithCustomerIncludingAssessedTax",
      "SalesRevenueNet",
    ],
    kind: "duration",
    statement: "income_statement",
  },
  {
    key: "net_income",
    tags: ["NetIncomeLoss", "NetIncomeLossAvailableToCommonStockholdersBasic", "ProfitLoss"],
    kind: "duration",
    statement: "income_statement",
    anchor: true,
  },
  { key: "operating_income", tags: ["OperatingIncomeLoss"], kind: "duration", statement: "income_statement" },
  { key: "total_assets", tags: ["Assets"], kind: "instant", statement: "balance_sheet", anchor: true },
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

/** Unit USD, bentuk 10-K; duration ≥ ~9.5 bln; buang nilai duplikat identik.
 * Form wajib 10-K (varian 10-K/A, 10-K405 ikut) — 10-Q TIDAK boleh lolos:
 * filer tertentu (suvenir nyata: AMZN) menandai nilai TTM 12-bulan di 10-Q
 * yang span-nya ≥330 hari dan bisa mencemari jendela periode jangkar. */
function pickAnnualUsdEntries(units: Record<string, FactUnit[]> | undefined): FactUnit[] {
  const usd = units?.USD ?? [];
  return usd.filter((u) => {
    if (typeof u.val !== "number" || !Number.isFinite(u.val)) return false;
    if (u.form && !u.form.startsWith("10-K")) return false; // 10-Q ditolak (TTM?)
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
 * - Bucket = pasangan (statement_type, tanggal period end) — BUKAN tahun `fy`,
 *   karena di XBRL `fy` adalah tahun FILING (periode 2016 yang dibandingkan di
 *   10-K FY2018 tetap membawa fy=2018; bekas kunci fy jadi mencampur periode).
 * - Jendela N periode terakhir per statement diambil dari aturan JANGKAR:
 *   net_income (income), total_assets (balance); cash flow mengikuti income.
 * - Setiap metrik diisi PER PERIODE dengan fallback tag: tag pertama yang punya
 *   entri untuk period end itu yang menang (prioritas = urutan rule.tags).
 *   Entri yang end-nya tidak sama dengan periode jangkar dibuang alami —
 *   contoh span komparatif Jan-1→Jan-1 tidak pernah cocok dengan periode fiskal.
 * - `fiscalYear` hanya aproksimasi label dari tahun period end (DB memakai
 *   period_end; konsumen baca periodEnd/data/statementType).
 */
export function buildStatementsFromCompanyFacts(facts: CompanyFacts, opts: { maxYears?: number } = {}): BuiltStatements {
  const usGaap = facts.facts?.["us-gaap"] ?? {};
  const maxYears = opts.maxYears ?? 10;

  // 1. Kandidat per rule: entri lolos filter + dedupe, diurut sesuai prioritas
  //    rule.tags. Tidak ada pemilihan satu tag "juara" global lagi.
  type Candidate = { tag: string; entries: FactUnit[] };
  type PerRule = { rule: ConceptRule; candidates: Candidate[] };
  const perRule: PerRule[] = [];
  const missing: string[] = [];

  for (const rule of CONCEPT_RULES) {
    const candidates: Candidate[] = [];
    for (const tag of rule.tags) {
      const concept = usGaap[tag];
      if (!concept?.units) continue;
      const picked = dedupeSamePeriod(pickAnnualUsdEntries(concept.units));
      if (picked.length > 0) candidates.push({ tag, entries: picked });
    }
    if (candidates.length === 0) {
      missing.push(rule.key);
      continue;
    }
    perRule.push({ rule, candidates });
  }

  if (perRule.length === 0) return { statements: [], missingConcepts: missing };

  // 2. Jendela periode per statement — dari period end jangkar (periode fiskal
  //    asli perusahaan), bukan fy filing. Tanpa jangkar: cash flow ikut income;
  //    kalau pun kosong → union semua end milik statement sendiri, top-N.
  const anchorEnds = new Map<StatementType, Set<string>>();
  const allEndsByStatement = new Map<StatementType, Set<string>>();
  for (const { rule, candidates } of perRule) {
    const all = allEndsByStatement.get(rule.statement) ?? new Set<string>();
    for (const cand of candidates) {
      for (const entry of cand.entries) all.add(toIsoDate(entry.end));
    }
    allEndsByStatement.set(rule.statement, all);
    if (rule.anchor) {
      const anchor = anchorEnds.get(rule.statement) ?? new Set<string>();
      for (const cand of candidates) {
        for (const entry of cand.entries) anchor.add(toIsoDate(entry.end));
      }
      anchorEnds.set(rule.statement, anchor);
    }
  }

  function windowFor(statement: StatementType): string[] {
    const direct = anchorEnds.get(statement);
    const source =
      direct ??
      (statement === "cash_flow" ? anchorEnds.get("income_statement") : undefined) ??
      allEndsByStatement.get(statement) ??
      new Set<string>();
    return [...source].sort((a, b) => b.localeCompare(a)).slice(0, maxYears);
  }

  // 3. Isi bucket per (statement, period end); tiap metrik satu nilai per
  //    periode, dipilih dari tag paling prioritas yang punya entri di periode itu.
  const buckets = new Map<string, StatementDraft>();
  const windows = new Map<StatementType, string[]>();
  for (const { rule, candidates } of perRule) {
    let window = windows.get(rule.statement);
    if (!window) {
      window = windowFor(rule.statement);
      windows.set(rule.statement, window);
    }
    for (const end of window) {
      for (const cand of candidates) {
        const hit = cand.entries.find((entry) => toIsoDate(entry.end) === end);
        if (!hit) continue;
        const key = `${rule.statement}|${end}`;
        const bucket = buckets.get(key) ?? {
          statementType: rule.statement,
          periodEnd: end,
          fiscalYear: Number.parseInt(end.slice(0, 4), 10),
          data: {} as Record<string, number>,
        };
        bucket.data[rule.key] = hit.val;
        buckets.set(key, bucket);
        break; // periode ini sudah terisi dari tag paling prioritas
      }
    }
  }

  const statements = [...buckets.values()].sort(
    (a, b) => a.statementType.localeCompare(b.statementType) || b.periodEnd.localeCompare(a.periodEnd),
  );
  return { statements, missingConcepts: missing };
}
