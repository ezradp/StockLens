import { describe, expect, it } from "vitest";
import {
  buildFundamentalImport,
  buildPriceImport,
  normalizeDate,
  normalizeHeader,
  statementTypeForMetric,
} from "@/lib/csv/import";

describe("normalizeHeader & normalizeDate", () => {
  it("membantu pemetaan header papaan", () => {
    expect(normalizeHeader("Adj Close")).toBe("adj_close");
    expect(normalizeHeader("  Period ID!! ")).toBe("period_id");
  });

  it("tanggal ISO & gaya US terbaca, sampah ditolak", () => {
    expect(normalizeDate("2026-01-02")).toBe("2026-01-02");
    expect(typeof normalizeDate("01/02/2026")).toBe("string"); // US order
    expect(normalizeDate("bukan tanggal")).toBeNull();
    expect(normalizeDate("")).toBeNull();
  });
});

describe("buildPriceImport", () => {
  it("mengurai OHLCV lengkap: alias, volume default, urutan tanggal naik", () => {
    const csv = [
      "Date,Open,High,Low,Close,Volume",
      "2026-01-02,10,11,9,10.5,1000",
      "2025-12-31,9.5,10,9,9.8,800",
      "2026-01-05,10.5,12,10.2,11.9,1200",
    ].join("\n");
    const result = buildPriceImport(csv);
    expect(result.missingColumns).toEqual([]);
    expect(result.rows.map((r) => r.date)).toEqual(["2025-12-31", "2026-01-02", "2026-01-05"]);
    expect(result.rows[2]).toEqual({ date: "2026-01-05", open: 10.5, high: 12, low: 10.2, close: 11.9, volume: 1200 });
    expect(result.rejected).toHaveLength(0);
    expect(result.ignoredColumns).toEqual([]);
  });

  it("baris rusak dilaporkan, tidak membunuh file", () => {
    const csv = [
      "date,open,high,low,close,volume",
      "2026-01-02,10,11,9,10.5,1000",
      "JANUARI MALAS,10,11,9,10.5,1000",
      "2026-01-03,8,7,6,5,100", // high < open, close < low
      "2026-01-02,10,11,9,10.5,500", // duplikat tanggal
    ].join("\n");
    const result = buildPriceImport(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.duplicateDates).toBe(1);
    expect(result.rejected.map((r) => r.reason).some((reason) => reason.includes("tanggal tidak terbaca"))).toBe(true);
    expect(result.rejected.map((r) => r.reason).some((reason) => reason.includes("high"))).toBe(true);
  });

  it("kolom wajib hilang dilaporkan eksplisit", () => {
    const result = buildPriceImport("date,close\n2026-01-02,10");
    expect(result.missingColumns).toEqual(["open", "high", "low"]);
    expect(result.rows).toEqual([]);
  });

  it("adj_close diabaikan dan disebut namanya", () => {
    const csv = "date,open,high,low,close,adj close\n2026-01-02,10,11,9,10.5,9.9";
    const result = buildPriceImport(csv);
    expect(result.ignoredColumns).toEqual(["adj_close"]);
    expect(result.rows).toHaveLength(1);
  });
});

describe("statementTypeForMetric", () => {
  it("maksud metrik ke tabel keuangan", () => {
    expect(statementTypeForMetric("revenue")).toBe("income_statement");
    expect(statementTypeForMetric("total_assets")).toBe("balance_sheet");
    expect(statementTypeForMetric("operating_cash_flow")).toBe("cash_flow");
    expect(statementTypeForMetric("hal_tak_dikenal")).toBeNull();
  });
});

describe("buildFundamentalImport", () => {
  it("format lebar: period_end + metrik otomatis + statement_type override", () => {
    const csv = [
      "period_end,revenue,net_income,total_assets,cash",
      "2026-12-31,1000,200,5000,300",
      "2025-12-31,900,180,4500,250",
    ].join("\n");
    const result = buildFundamentalImport(csv);
    expect(result.groups).toHaveLength(4); // 2 income (revenue, net_income) + 2 balance group (assets, cash)
    const income = result.groups.filter((g) => g.statementType === "income_statement");
    expect(income.map((g) => g.periodEnd).sort()).toEqual(["2025-12-31", "2026-12-31"]);
    const balance2026 = result.groups.find((g) => g.statementType === "balance_sheet" && g.periodEnd === "2026-12-31");
    expect(balance2026?.data).toEqual({ total_assets: 5000, cash: 300 });
    expect(result.rejected).toEqual([]);
  });

  it("statement_type kolom memindahkan semua metrik baris itu", () => {
    const csv = [
      "period_end,statement_type,revenue,operating_cash_flow",
      "2026-12-31,cash_flow,100,50",
    ].join("\n");
    const result = buildFundamentalImport(csv);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.statementType).toBe("cash_flow");
  });

  it("metrik tak dikenal ditolak dengan saran, nilai konflik dtolak, duplikat disatukan", () => {
    const csv = [
      "period_end,revenue,random_thing",
      "2026-12-31,1000,7",
      "2026-12-31,1000,7",
      "2026-12-31,999,7",
    ].join("\n");
    const result = buildFundamentalImport(csv);
    expect(result.ignoredColumns).toEqual(["random_thing"]);
    expect(result.mergedDuplicates).toBe(1);
    expect(result.rejected.some((r) => r.reason.includes("bertentangan"))).toBe(true);
    expect(result.rejected.some((r) => r.reason.includes("tidak dikenal"))).toBe(true);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.data.revenue).toBe(1000);
  });

  it("period_end hilang → galat keras line 1", () => {
    const result = buildFundamentalImport("revenue\n100");
    expect(result.groups).toEqual([]);
    expect(result.rejected[0]?.line).toBe(1);
  });
});
