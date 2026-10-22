import { describe, expect, it } from "vitest";
import { buildStatementsFromCompanyFacts, type CompanyFacts } from "@/lib/dataProviders/secEdgar";
import type { FactUnit } from "@/lib/dataProviders/secEdgar";

/** Entri tahunan sintetis: 10-K, durasi ±365 hari (lolos filter ≥330 hari). */
function annualUnit(fy: number, val: number, monthEnd = "09-30"): FactUnit {
  return {
    start: monthEnd === "09-30" ? `${fy - 1}-10-01` : `${fy - 1}-01-01`,
    end: `${fy}-${monthEnd}`,
    val,
    fy,
    fp: "FY",
    form: "10-K",
    frame: `CY${fy}`,
  };
}

function factsWith(entries: Record<string, FactUnit[]>): CompanyFacts {
  return {
    entityName: "Synthetic Co",
    facts: {
      "us-gaap": Object.fromEntries(
        Object.entries(entries).map(([tag, units]) => [
          tag,
          { label: tag, units: { USD: units } },
        ]),
      ),
    },
  };
}

describe("buildStatementsFromCompanyFacts — disiplin periode & fallback tag", () => {
  it("isi per periode: tag modern menang, tag usang hanya menutup gap lama (regresi kasus AAPL)", () => {
    const facts = factsWith({
      // Tag usang tinggal 2 periode lama (perilaku nyata AAPL "Revenues").
      Revenues: [2015, 2016].map((fy) => annualUnit(fy, fy * 10)),
      // Tag modern menutup 8 periode terkini.
      RevenueFromContractWithCustomerExcludingAssessedTax: [
        2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024,
      ].map((fy) => annualUnit(fy, fy * 100)),
      // Jangkar: 10 periode → jendela income mengikuti period end NI.
      NetIncomeLoss: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024].map((fy) =>
        annualUnit(fy, fy * 7),
      ),
    });

    const built = buildStatementsFromCompanyFacts(facts);
    const income = built.statements.filter((s) => s.statementType === "income_statement");
    expect(income).toHaveLength(10); // jendela = 10 period end jangkar
    for (const statement of income) {
      const fy = statement.fiscalYear;
      // 2015–2016 diisi tag usang; 2017–2024 diisi tag modern — per periode.
      expect(statement.data.revenue).toBe(fy <= 2016 ? fy * 10 : fy * 100);
    }
    expect(built.missingConcepts).not.toContain("revenue");
    // Aturan lain yang tak ada di facts tetap dilaporkan jujur.
    expect(built.missingConcepts).toContain("total_assets");
    expect(built.missingConcepts).toContain("operating_cash_flow");
  });

  it("span komparatif Jan-1→Jan-1 (fy semua sama) tidak membuat bucket palsu (regresi kasus AMZN)", () => {
    // Nyata di EDGAR: satu tag bisa menampung banyak entri komparatif dalam SATU
    // filing, semuanya fy = tahun filing, span Jan-1→Jan-1 (bukan periode fiskal).
    const junk: FactUnit[] = Array.from({ length: 15 }, (_, i) => ({
      start: `${2010 + i}-01-01`,
      end: `${2011 + i}-01-01`,
      val: 5000 + i,
      fy: 2024,
      fp: "FY",
      form: "10-K",
      frame: null,
    }));
    const facts = factsWith({
      Revenues: junk,
      RevenueFromContractWithCustomerExcludingAssessedTax: [
        2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024,
      ].map((fy) => annualUnit(fy, fy * 100, "12-31")),
      NetIncomeLoss: [2016, 2017, 2018].map((fy) => annualUnit(fy, fy * 7, "12-31")),
    });

    const built = buildStatementsFromCompanyFacts(facts);
    const income = built.statements.filter((s) => s.statementType === "income_statement");
    // Jendela 3 periode dari jangkar NI (31 Des); junk 1 Jan tak pernah cocok.
    expect(income).toHaveLength(3);
    for (const statement of income) {
      expect(statement.data.revenue).toBe(statement.fiscalYear * 100);
    }
  });

  it("dua tag sama-sama punya periode → tag pertama (prioritas daftar) yang menang", () => {
    const facts = factsWith({
      Revenues: [2021, 2022, 2023].map((fy) => annualUnit(fy, 1111 + fy)),
      RevenueFromContractWithCustomerExcludingAssessedTax: [2021, 2022, 2023].map((fy) =>
        annualUnit(fy, 9000 + fy),
      ),
      NetIncomeLoss: [2021, 2022, 2023].map((fy) => annualUnit(fy, fy * 7)),
    });

    const built = buildStatementsFromCompanyFacts(facts);
    const income = built.statements.filter((s) => s.statementType === "income_statement");
    expect(income).toHaveLength(3);
    for (const statement of income) {
      expect(statement.data.revenue).toBe(1111 + statement.fiscalYear);
    }
  });

  it("tidak ada tag cocok → statements kosong + missingConcepts eksplisit", () => {
    const built = buildStatementsFromCompanyFacts(factsWith({}));
    expect(built.statements).toHaveLength(0);
    expect(built.missingConcepts).toContain("revenue");
    expect(built.missingConcepts).toContain("net_income");
  });

  it("kuartal & form non-10-K tersaring — hanya tahunan yang dianggap", () => {
    const facts = factsWith({
      Assets: [
        { start: "2022-12-30", end: "2023-12-31", val: 900, fy: 2023, form: "10-K", frame: "CY2023" },
        { start: "2023-01-01", end: "2023-02-28", val: 999, fy: 2023, form: "10-K", frame: "CY2023Q1" },
        { start: "2023-01-01", end: "2023-03-31", val: 998, fy: 2023, form: "10-Q", frame: "CY2023Q1" },
        // TTM 12 bln dari 10-Q (span ≥330) — kasus AMZN: form ditolak, span boleh.
        { start: "2022-04-01", end: "2023-03-31", val: 777, fy: 2023, form: "10-Q", frame: null },
      ],
    });

    const built = buildStatementsFromCompanyFacts(facts);
    const balance = built.statements.filter((s) => s.statementType === "balance_sheet");
    expect(balance).toHaveLength(1);
    expect(balance.map((s) => s.periodEnd)).toEqual(["2023-12-31"]); // bukan TTM 2023-03-31
    expect(balance[0].data.total_assets).toBe(900); // durasi 10-K tahunan
  });
});
