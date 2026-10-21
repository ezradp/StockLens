-- StockLens — default kepemilikan (Phase 2 — Auth).
-- Kolom user_id pada tabel personal diberi DEFAULT app.auth_uid() (konvensi Supabase)
-- agar INSERT dari client tidak perlu mengirim user_id: PostgREST mengerti kolom
-- yang dihilangkan tetap diisi default berdasarkan JWT request-nya.
-- Policy WITH CHECK (0005) sudah menjamin user_id yang dikirim eksplisit tetap
-- harus sama dengan user pemilik JWT — jadi keamanan tidak bergantung pada default.
-- Portabel: di Postgres lokal, cukup SET "request.jwt.claims" saat pengujian.

--> statement-breakpoint

ALTER TABLE import_batches       ALTER COLUMN user_id SET DEFAULT app.auth_uid();

--> statement-breakpoint

ALTER TABLE watchlists           ALTER COLUMN user_id SET DEFAULT app.auth_uid();

--> statement-breakpoint

ALTER TABLE portfolios           ALTER COLUMN user_id SET DEFAULT app.auth_uid();

--> statement-breakpoint

ALTER TABLE valuation_scenarios  ALTER COLUMN user_id SET DEFAULT app.auth_uid();

--> statement-breakpoint

ALTER TABLE saved_screens        ALTER COLUMN user_id SET DEFAULT app.auth_uid();

--> statement-breakpoint

ALTER TABLE research_notes       ALTER COLUMN user_id SET DEFAULT app.auth_uid();
