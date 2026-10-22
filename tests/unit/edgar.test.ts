import { describe, expect, it } from "vitest";
import {
  buildStatementsFromCompanyFacts,
  type CompanyFacts,
  type FactUnit,
} from "@/lib/dataProviders/secEdgar";

/** Fixture mini CompanyFacts: 3 tahun, kuartal, duplikat, tag alternatif. */
function usd(entries: Array<Partial<FactUnit> & { val: number }>): FactUnit[] {
  return entries.map((entry) => ({
    end: entry.end ?? "2024-12-31",
    val: entry.val,
    ...(entry.start ? { start: entry.start } : {}),
    ...(entry.fy !== undefined ? { fy: entry.fy } : {}),
    ...(entry.form ? { form: entry.form } : {}),
    ...(entry.frame !== undefined ? { frame: entry.frame } : {}),
    ...(entry.fp ? { fp: entry.fp } : {}),
  }));
}

const fixture: CompanyFacts = {
  entityName: "PT Contoh Mega Kapital",
  facts: {
    "us-gaap": {
      Revenues: {
        units: {
          USD: [
            ...usd([
              { start: "2023-01-01", end: "2023-12-31", val: 1000, fy: 2023, form: "10-K", frame: "CY2023" },
              { start: "2022-01-01", end: "2022-12-31", val: 800, fy: 2022, form: "10-K", frame: "CY2022" },
              { start: "2021-01-01", end: "2021-12-31", val: 700, fy: 2021, form: "10-K", frame: "CY2021" },
              // kuartal — harus terfilter span < 330 hari
              { start: "2023-10-01", end: "2023-12-31", val: 300, fy: 2023, form: "10-Q" },
              // span semester ~181 hari — terfilter meski 10-K
              { start: "2024-01-01", end: "2024-06-30", val: 500, fy: 2024, form: "10-K" },
            ]),
          ],
        },
      },
      NetIncomeLoss: {
        units: {
          USD: usd([
            { start: "2023-01-01", end: "2023-12-31", val: 200, fy: 2023, form: "10-K", frame: "CY2023" },
            { start: "2022-01-01", end: "2022-12-31", val: 150, fy: 2022, form: "10-K", frame: "CY2022" },
            { start: "2021-01-01", end: "2021-12-31", val: 120, fy: 2021, form: "10-K", frame: "CY2021" },
          ]),
        },
      },
      Assets: {
        units: {
          USD: usd([
            { end: "2023-12-31", val: 5000, fy: 2023, form: "10-K", frame: "CY2023" },
            { end: "2022-12-31", val: 4500, fy: 2022, form: "10-K", frame: "CY2022" },
            { end: "2023-12-31", val: 5000, fy: 2023, form: "10-K", frame: "CY2023Q4I" }, // duplikat identik
          ]),
        },
      },
    },
  },
};

describe("buildStatementsFromCompanyFacts", () => {
  const built = buildStatementsFromCompanyFacts(fixture, { maxYears: 10 });

  it("menghasilkan bucket laporan per (tipe, period end); jendela dari jangkar", () => {
    const income = built.statements.filter((s) => s.statementType === "income_statement");
    const balance = built.statements.filter((s) => s.statementType === "balance_sheet");
    expect(income).toHaveLength(3); // 2023, 2022, 2021
    expect(balance).toHaveLength(2);
  });

  it("kuartal dan semester tidak bocor ke seed tahunan", () => {
    const income2023 = built.statements.find(
      (s) => s.statementType === "income_statement" && s.fiscalYear === 2023,
    );
    expect(income2023?.data.revenue).toBe(1000); // bukan 300 (kuartal) / 500 (semester)
  });

  it("dedup entri identik: Assets 2023 bernilai tunggal", () => {
    const balance2023 = built.statements.find(
      (s) => s.statementType === "balance_sheet" && s.fiscalYear === 2023,
    );
    expect(balance2023?.data.total_assets).toBe(5000);
  });

  it("metrik yang tak ada tag-nya dilaporkan apa adanya", () => {
    expect(built.missingConcepts).toContain("operating_cash_flow");
    expect(built.missingConcepts).toContain("capex");
    expect(built.missingConcepts).toContain("operating_income");
  });

  it("maxYears membatasi himpunan tahun terbaru", () => {
    const limited = buildStatementsFromCompanyFacts(fixture, { maxYears: 1 });
    const years = new Set(limited.statements.map((s) => s.fiscalYear));
    expect(years).toEqual(new Set([2023]));
  });

  it("companyfacts tanpa us-gaap → kosong dan tidak melempar", () => {
    const empty = buildStatementsFromCompanyFacts({ facts: {} });
    expect(empty.statements).toEqual([]);
  });
});
