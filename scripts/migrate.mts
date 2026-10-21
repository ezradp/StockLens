/**
 * Migration runner StockLens — menerapkan file SQL dari database/migrations
 * secara berurutan dengan pelacakan via tabel schema_migrations.
 *
 * Portabel: bekerja di PostgreSQL mana pun (Supabase free, hosting lain, lokal).
 * Tanpa kode di luar file .sql → tidak ada logika migrasi tersembunyi.
 *
 * Jalur env: DATABASE_URL (dibaca Node --env-file-if-exists=.env).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import postgres from "postgres";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = join(ROOT, "database", "migrations");

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error(
    [
      "DATABASE_URL belum diisi.",
      "",
      "Isi file .env (salin dari .env.example) dengan connection string Postgres:",
      "  - Supabase: Project Settings → Database → Connection string (URI).",
      "  - PostgreSQL lokal juga didukung.",
      "",
      "Lalu jalankan ulang: npm run db:migrate",
    ].join("\n"),
  );
  process.exit(1);
}

const MARKER_SPLIT = /\r?\n--> statement-breakpoint\r?\n/;
const sql = postgres(url, { max: 1 });

async function main() {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;

  const appliedRows = await sql`SELECT filename FROM schema_migrations`;
  const applied = new Set(appliedRows.map((row) => row.filename as string));

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.error(`Tidak ada file .sql di ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  let newlyApplied = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`= ${file} (sudah diterapkan)`);
      continue;
    }

    const raw = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const statements = raw
      .split(MARKER_SPLIT)
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    try {
      await sql.begin(async (tx) => {
        for (const statement of statements) {
          await tx.unsafe(statement);
        }
        await tx`INSERT INTO schema_migrations (filename) VALUES (${file})`;
      });
    } catch (error) {
      console.error(`✗ ${file} gagal pada statement ke-${statements.length}+1:`, error);
      await sql.end();
      process.exit(1);
    }

    console.log(`✓ ${file} (${statements.length} statement)`);
    newlyApplied += 1;
  }

  console.log(
    newlyApplied === 0 ? "Database sudah mutakhir." : `Selesai: ${newlyApplied} migrasi baru diterapkan.`,
  );
  await sql.end();
}

main().catch((error) => {
  console.error("Migration runner error:", error);
  process.exit(1);
});
