import { describe, expect, it } from "vitest";
import { detectDelimiter, parseCsv, parseNumberLoose } from "@/lib/csv/parse";

describe("detectDelimiter", () => {
  it("memilih koma, titik-koma, sesuai kemunculan tertinggi", () => {
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
  });

  it("tidak menghitung delimiter di dalam kutip", () => {
    expect(detectDelimiter('"a,b","c"[..]')).toBe(",");
    expect(detectDelimiter('"a;b"\n"c,d"')).toBe(",");
  });

  it("default koma bila tidak ada pembeda", () => {
    expect(detectDelimiter("abc\ndef")).toBe(",");
  });
});

describe("parseCsv", () => {
  it("mengurai tabel sederhana, header di-trim, baris data selebar header", () => {
    const result = parseCsv("Ticker,Price,AAPL\r\nAAPL,10,2026-01-02\r\nMSFT,50,2026-01-03\n");
    expect(result.delimiter).toBe(",");
    expect(result.headers).toEqual(["Ticker", "Price", "AAPL"]);
    expect(result.rows).toEqual([
      ["AAPL", "10", "2026-01-02"],
      ["MSFT", "50", "2026-01-03"],
    ]);
    expect(result.errors).toEqual([]);
  });

  it("kutip ganda melindungi koma, newline, dan kutip literal", () => {
    const result = parseCsv('name,note\n"Nakamura, Ryo","says ""hello""\nworld"');
    expect(result.rows).toEqual([["Nakamura, Ryo", 'says "hello"\nworld']]);
    expect(result.errors).toEqual([]);
  });

  it("membuang UTF-8 BOM dari header pertama", () => {
    const result = parseCsv("\uFEFFticker,close\nBRK.B,100");
    expect(result.headers).toEqual(["ticker", "close"]);
  });

  it("baris kosong murni dilewati, CRLF/LF/CR campur diterima", () => {
    const result = parseCsv("a,b\n1,2\r\r\n\n3,4");
    expect(result.rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("baris ragged dilapisi/dipotong agar selebar header", () => {
    const result = parseCsv("a,b,c\n1,2\n1,2,3,4");
    expect(result.rows).toEqual([
      ["1", "2", ""],
      ["1", "2", "3"],
    ]);
  });

  it("kutip tidak tertutup dilaporkan non-fatal tanpa melempar", () => {
    const result = parseCsv('a,b\nx,"unclosed');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("Tanda kutip");
    expect(result.rows[0]?.[0]).toBe("x");
  });

  it("delimiter dipaksa bila diberikan", () => {
    const result = parseCsv("a;b;c", { delimiter: ";" });
    expect(result.headers).toEqual(["a", "b", "c"]);
  });

  it("file satu baris tanpa newline akhir tetap menghasilkan 1 baris data", () => {
    const result = parseCsv("a,b\n5,6");
    expect(result.rows).toEqual([["5", "6"]]);
  });
});

describe("parseNumberLoose", () => {
  it("menerka angka berformat manusia", () => {
    expect(parseNumberLoose("123.45")).toBe(123.45);
    expect(parseNumberLoose("1.234,56")).toBe(1234.56); // Eropa
    expect(parseNumberLoose("1,234.56")).toBe(1234.56); // Amerika
    expect(parseNumberLoose("Rp 12.500")).toBe(12500);
    expect(parseNumberLoose("US$1,000")).toBe(1000);
    expect(parseNumberLoose("47%")).toBe(47);
    expect(parseNumberLoose("  -8% ")).toBe(-8);
  });

  it("mengembalikan null untuk non-angka yang jujur", () => {
    expect(parseNumberLoose("")).toBeNull();
    expect(parseNumberLoose("-")).toBeNull();
    expect(parseNumberLoose("N/A")).toBeNull();
    expect(parseNumberLoose("abc")).toBeNull();
  });
});
