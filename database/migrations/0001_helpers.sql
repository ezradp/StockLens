-- StockLens — helpers (portable PostgreSQL, Supabase-compatible).
-- Buat schema helper dan fungsi kunci. Tabel bisnis ada di file berikutnya.

--> statement-breakpoint

CREATE SCHEMA IF NOT EXISTS app;

--> statement-breakpoint

-- Pengganti portabel untuk auth.uid() milik Supabase.
-- - Di Supabase: PostgREST/Kong mengisi `request.jwt.claims` per request, sehingga
--   fungsi ini menghasilkan user id dari JWT — perilaku identik dengan auth.uid().
-- - PostgreSQL lokal lain: cukup `SET "request.jwt.claims" = '{"sub":"<uuid>"}'`
--   sebelum query untuk mengujinya.
CREATE OR REPLACE FUNCTION app.auth_uid() RETURNS uuid
LANGUAGE plpgsql STABLE AS $$
DECLARE
  claim text;
BEGIN
  claim := NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '');
  IF claim IS NULL OR claim !~ '^[0-9a-fA-F-]{36}$' THEN
    RETURN NULL;
  END IF;
  RETURN claim::uuid;
END;
$$;

--> statement-breakpoint

-- Trigger helper: menjaga kolom updated_at tetap benar.
CREATE OR REPLACE FUNCTION app.set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
