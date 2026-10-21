# StockLens

Platform riset investasi web — fundamental, screener, DCF valuation, dan portofolio — dibangun dengan prinsip **zero-cost-first**: semua fitur inti berjalan tanpa API berbayar, dengan calculation engine internal dan data yang transparan sumbernya.

> **TL;DR (setup cepat):** Node ≥ 22.12 → `npm install` → salin `.env.example` jadi `.env` dan isi kredensial Supabase → `npm run db:migrate` → `npm run dev`.

---

## Status Roadmap

| Fase | Konten | Status |
|---|---|---|
| 1 — Foundation | Scaffolding, UI shell dark, migrasi SQL + RLS, testing pipeline | ✅ Selesai (7 migrasi diterapkan ke Supabase) |
| 2 — Authentication | Supabase Auth, profiles, proxy guard, RLS test isolasi 2 user | ✅ Selesai (14/14 test, build hijau) |
| 3 — Data | Seed historis (EDGAR + Tiingo), CSV import wizard | ⏳ |
| 4 — Stock Explorer | Company detail, financial tables, charts, metrics | ⏳ |
| 5 — Screener & Comparison | Filter, sorting, scoring, saved screens, compare | ⏳ |
| 6 — DCF Engine | Kalkulator + sensitivity + scenarios | ⏳ |
| 7 — Portfolio Tracker | Transaksi, cost basis, P/L, alokasi | ⏳ |
| 8 — Insights & Research | Rule-based insights, notes | ⏳ |
| 9 — QA & Deployment | E2E, keamanan, README deploy | ⏳ |

Setiap fase lulus gerbang: `lint`, `typecheck`, `test`, `build`.

## Requirements

- **Node.js ≥ 22.12** (migration runner memakai `--env-file-if-exists`; dikembangkan dengan Node 24)
- npm (bawaan Node)

## Autentikasi (Fase 2)

- **Supabase Auth** email+password. Setiap user baru mendapat baris `profiles` otomatis
  (trigger `on_auth_user_created`, migrasi `0006`).
- Route guard di `src/proxy.ts` — konvensi `proxy` Next.js 16 (pengganti `middleware`):
  halaman app wajib login, halaman auth dialihkan ke `/overview` bila sudah login.
  Guard kedua (defence-in-depth) ada di `src/app/(app)/layout.tsx`.
- Kolom `user_id` pada semua tabel personal punya `DEFAULT app.auth_uid()` (migrasi `0007`),
  jadi INSERT dari client otomatis melekat ke pemilik JWT; policy `WITH CHECK` (0005)
  tetap menolak `user_id` milik user lain.
- Elemen shell `(app)` dinilai dinamis (`export const instant = false`) karena shell
  berada di balik sesi — Next 16 Cache Components tidak prerender guard ber-cookie.
- **Email confirmation**: ikuti default project Supabase (rekomendasi: ON). Bila ON,
  pendaftaran menampilkan instruksi "cek email" lalu user masuk setelah konfirmasi.
  Pesan galat login selalu generik agar tidak membocorkan keberadaan akun.
- **Integration test isolasi RLS** (`tests/integration/rls.test.ts`) berjalan otomatis
  saat kredensial Supabase ada di `.env`: membuat 2 test users (email
  `stocklens-…@stocklens.test`), memverifikasi user A tidak melihat/mengubah/menghapus
  data user B, lalu **menghapus** kedua user + datanya di akhir test.

## Getting Started

```bash
npm install

# 1. Salin contoh environment dan isi kredensial Anda
cp .env.example .env

# 2. Terapkan migrasi database (SQL murni + RLS)
npm run db:migrate

# 3. Jalankan development server
npm run dev
```

Buka `http://localhost:3000` → dialihkan ke `/overview`. Halaman data akan menampilkan
state penyiapan yang jujur sampai kredensial/database tersedia — tanpa data palsu.

### Environment

| Variabel | Wajib | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | Project URL (bukan secret) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | Anon key (bukan secret) |
| `DATABASE_URL` | ✓ (untuk migrate) | Connection string Postgres |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ (server) | **Secret** — hanya server, tak pernah ke client bundle |
| `PRICE_PROVIDER` | — Fase 3 | `tiingo` \| `twelvedata` \| `none` |
| `PRICE_PROVIDER_API_KEY` | — Fase 3 | Free key provider harga |

## Database

- Migrasi: file **SQL murni** di `database/migrations/` — portabel ke PostgreSQL mana pun
  (Supabase Free, hosting lain, atau lokal), tanpa logika tersembunyi.
- Runner: `scripts/migrate.mts` — urut, idempoten (tabel `schema_migrations`), satu file
  = satu transaction, dipisah via `--> statement-breakpoint`.
- Skema & aturan akses: lihat [`docs/schema.md`](docs/schema.md).
- RLS: tabel personal dikunci per `user_id` via `app.auth_uid()` (portabel pengganti
  `auth.uid()`); data pasar/fundamen bersama dibaca semua user terautentikasi; write
  data pasar hanya untuk `service_role` (server) + DELETE baris impor milik sendiri.

## Testing

```bash
npm test            # unit + integration (RLS isolation) — berjalan bila kredensial ada
npm run test:watch
# E2E (Playwright — butuh browser sekali saja):
npx playwright install chromium
npm run test:e2e
```

Fixture kalkulasi (golden tests, Fase 6–7) menggunakan nilai yang dihitung
independen — bukan sekadar membandingkan snapshot halaman.

## Struktur Proyek

```
src/
  app/            # Routing & halaman (App Router)
    (app)/        # Shell ber-autentikasi (10 route navigasi utama)
    (auth)/       # Login & register (server actions + Supabase Auth)
  proxy.ts        # Guard sesi per request (konvensi proxy Next 16)
  components/     # UI primitives (Button/Card/Badge/…) & state (Empty/Error/Skeleton)
  engine/         # Calculation engine murni (tanpa I/O, unit-testable)
  lib/            # Env, Supabase client, formatter, csv (Fase 3)
  server/         # Data access layer (Fase 2+)
database/migrations/  # SQL murni — single source of truth skema
scripts/             # Migration runner
docs/                # Dokumentasi skema & keputusan
tests/               # unit / integration / e2e
```

## Data & Lisensi (transparansi sumber)

- **SEC EDGAR** (fundamental seed): API `data.sec.gov` gratis tanpa key; konten EDGAR
  bebas diakses dan di-reuse sesuai FAQ resmi SEC. Syarat teknis: deklarasi User-Agent
  berisi kontak dan maksimal 10 request/detik.
- **Tiingo** (harga EOD, Fase 3, free Starter tier): 500 simbol/bulan, 50 req/jam,
  1.000 req/hari, sejarah 30+ tahun. Lisensinya personal/internal — data provider
  dipakai untuk **seed pengembangan**, bukan konten publik; jalur data pengguna adalah
  CSV milik pengguna sendiri. Fallback: Twelve Data Basic (800 credits/hari).
- **CSV import** adalah jalur utama memasukkan data — aplikasi tidak pernah meng-scrape
  situs yang lisensinya melarang.
- Data demo/seed **diberi label eksplisit** (`source_type`, `source_name`, timestamp) dan
  tidak pernah disajikan sebagai harga real-time.

## Catatan Kebijakan Biaya

Target biaya wajib Rp0 dapat dicapai dalam konfigurasi MVP (free tier Supabase/Vercel,
library gratis, tanpa API berbayar). Free tier dapat berubah dan punya kuota; hosting,
domain, atau kebutuhan operasional di luar cakupan tersebut tidak termasuk dalam target.

## Keamanan

- Secret (`SUPABASE_SERVICE_ROLE_KEY`) hanya dibaca di server.
- Akses data divalidasi di database (RLS) dan server — bukan hanya UI.
- Input (env, CSV, API) divalidasi via Zod sebelum diproses.
- Error tidak menampilkan stack/secret ke pengguna.
