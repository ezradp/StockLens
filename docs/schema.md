# Skema Database StockLens

Sumber kebenaran: file migrasi di `database/migrations/` ( Portabilitas PostgreSQL murni, termasuk Supabase Free ).

| Tabel | Penggunaan | Pemilik | Catatan kunci |
|---|---|---|---|
| `profiles` | Preferensi pengguna | 1 baris per user | `id` = auth user id; FK ke `auth.users` ditambahkan secara kondisional di Supabase |
| `companies` | Master perusahaan | Bersama | `lower(ticker)` unik; sektor/industry dari SIC (seed EDGAR) |
| `market_prices` | Barisan harga OGHLV | Bersama (baca) | Unik `(company_id, date)`; `source_type`/`source_name`/`import_batch_id` wajib transparan; CHECK bentuk candle |
| `financial_statements` | Pernyataan keuangan | Bersama (baca) | `data_json` per baralan; unik `(company_id, statement_type, period_type, period_end)` |
| `import_batches` | Riwayat impor CSV | User | `status` + jumlah baris diterima/ditolak |
| `watchlists` / `watchlist_items` | Watchlist | User | Unique user+name; unique item dalam watchlist |
| `portfolios` / `portfolio_transactions` | Portofolio | User | CHECK domain transaksi (buy/sell vs cash vs dividend/fee) |
| `valuation_scenarios` | DCF tersimpan | User | `assumptions_json`, `results_json` (JSONB) |
| `saved_screens` | Filter tersimpan | User | `filters_json` (JSONB) |
| `research_notes` | Catatan riset | User | Relasi opsional ke company |

## Aturan akses (RLS — `0005_rls.sql`)

- `authenticated`: baca data bersama; CRUD penuh HANYA atas baris miliknya (`user_id = app.auth_uid()`); hapus baris impor miliknya lewat `import_batches`.
- `anon`: tidak mendapat akses (default deny).
- `service_role`: bypass RLS — dipakai server untuk seed/admin.

`app.auth_uid()` adalah pengganti portabel `auth.uid()`: membaca JWT dari
`request.jwt.claims` (diisi PostgREST/Supabase) dan mengembalikan uuid atau NULL.
Set lokal untuk pengujian: `SET "request.jwt.claims" = '{"sub":"<uuid>"}'`.

## Bootstrap akun & default kepemilikan (0006, 0007)

- Trigger `on_auth_user_created` (Supabase-only, dibungkus guard `auth.users`):
  setiap user baru di `auth.users` otomatis mendapat baris `profiles` (backfill juga
  dieksekusi sekali untuk user lama).
- Kolom `user_id` pada tabel personal (`import_batches`, `watchlists`, `portfolios`,
  `valuation_scenarios`, `saved_screens`, `research_notes`) memakai
  `DEFAULT app.auth_uid()`: INSERT dari client tidak perlu mengirim `user_id`,
  dan policy `WITH CHECK` (0005) tetap menolak `user_id` milik user lain.
