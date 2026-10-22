-- StockLens — pelonggaran CHECK batch-import (Fase 3).
-- Ketemu lewat integration test choreography import:
--   CHECK `source_type='import' → import_batch_id IS NOT NULL` terbentur FK
--   import_batches.id ON DELETE SET NULL: menghapus riwayat meng-NULL-kan
--   batch id lalu melarang DELETE itu sendiri → user tak bisa membersihkan
--   riwayat impor-nya.
-- Semantik yang diminta (PRD): import_batch_id = jejak audit selama riwayat
-- hidup; bila riwayat dihapus, baris data tetap sah dan transparan lewat
-- source_name (nama file). CHECK baru: baris impor wajib punya source_name.

--> statement-breakpoint

ALTER TABLE market_prices
  DROP CONSTRAINT market_prices_import_requires_batch;
ALTER TABLE market_prices
  ADD CONSTRAINT market_prices_import_requires_batch
  CHECK (source_type <> 'import' OR source_name <> '');

--> statement-breakpoint

ALTER TABLE financial_statements
  DROP CONSTRAINT financial_statements_import_requires_batch;
ALTER TABLE financial_statements
  ADD CONSTRAINT financial_statements_import_requires_batch
  CHECK (source_type <> 'import' OR source_name <> '');
