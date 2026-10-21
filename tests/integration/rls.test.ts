import postgres from "postgres";
import { describe, it, expect } from "vitest";

/**
 * Suite integrasi migrasi + RLS.
 * Aktif HANYA dengan TEST_DATABASE_URL (database terisolasi/mampu di-reset):
 *   TEST_DATABASE_URL=postgres://... npm run test:integration
 * Detail pengujian isolasi dua user (dengan token auth) dikerjakan di Fase 2.
 */
const RUN = Boolean(process.env.TEST_DATABASE_URL);
const TEST_SUB = "00000000-0000-4000-8000-000000000001";

describe.skipIf(!RUN)("portabilitas helper auth (migrasi 0001)", () => {
  it("app.auth_uid() membaca JWT claims dan null untuk claims kosong", async () => {
    const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1 });
    try {
      await sql.unsafe(
        `SET "request.jwt.claims" = '${JSON.stringify({ sub: TEST_SUB })}'`,
      );
      const [withUser] = await sql`SELECT app.auth_uid() AS uid`;
      expect(withUser.uid).toBe(TEST_SUB);

      await sql.unsafe(`SET "request.jwt.claims" = ''`);
      const [withoutUser] = await sql`SELECT app.auth_uid() AS uid`;
      expect(withoutUser.uid).toBeNull();
    } finally {
      await sql.end();
    }
  });
});
