-- StockLens — Fase 6 (DCF): jumlah saham beredar pada master perusahaan.
-- Nullable: tidak semua sumber menyediakannya; DCF per-saham menunggu nilai ini
-- (diisi lewat seed/impor/admin) atau assumption manual di halaman valuasi.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS shares_outstanding bigint;

COMMENT ON COLUMN companies.shares_outstanding IS
  'Jumlah saham beredar (unit saham, bukan dalam ribuan). NULL = belum tersedia.';
