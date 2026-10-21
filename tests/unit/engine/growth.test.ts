import { describe, expect, it } from "vitest";
import { cagrToPercent, computeCagr } from "@/engine/growth";

describe("computeCagr", () => {
  it("menghitung CAGR dasar dengan tepat", () => {
    // 100 → 121 dalam 2 tahun = pertumbuhan 10% per tahun
    expect(computeCagr({ startValue: 100, endValue: 121, years: 2 })).toBeCloseTo(0.1, 12);
  });

  it("menghitung CAGR 10 tahun", () => {
    // 1000 → 10000 dalam 10 tahun = 10^0.1 − 1
    expect(computeCagr({ startValue: 1000, endValue: 10000, years: 10 })).toBeCloseTo(
      Math.pow(10, 0.1) - 1,
      12,
    );
  });

  it("mengembalikan null untuk nilai awal/akhir tidak valid — bukan nol", () => {
    expect(computeCagr({ startValue: 0, endValue: 121, years: 2 })).toBeNull();
    expect(computeCagr({ startValue: -50, endValue: 121, years: 2 })).toBeNull();
    expect(computeCagr({ startValue: 100, endValue: -5, years: 2 })).toBeNull();
    expect(computeCagr({ startValue: 100, endValue: 0, years: 2 })).toBeNull();
  });

  it("mengembalikan null untuk periode tidak valid", () => {
    expect(computeCagr({ startValue: 100, endValue: 121, years: 0 })).toBeNull();
    expect(computeCagr({ startValue: 100, endValue: 121, years: -3 })).toBeNull();
    expect(computeCagr({ startValue: 100, endValue: 121, years: Number.NaN })).toBeNull();
  });

  it("mengembalikan null untuk input non-finite", () => {
    expect(computeCagr({ startValue: Number.NaN, endValue: 121, years: 2 })).toBeNull();
    expect(computeCagr({ startValue: 100, endValue: Number.POSITIVE_INFINITY, years: 2 })).toBeNull();
  });

  it("cagrToPercent meneruskan null tanpa membuat angka", () => {
    expect(cagrToPercent(null)).toBeNull();
    expect(cagrToPercent(0.18)).toBeCloseTo(18, 12);
  });
});
